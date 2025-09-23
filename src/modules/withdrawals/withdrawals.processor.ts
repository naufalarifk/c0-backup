/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import type { Job, Queue } from 'bullmq';
import type { WithdrawalProcessingData } from './withdrawals-queue.service';

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';
import { ethers } from 'ethers';
import invariant from 'tiny-invariant';

import { CryptographyService } from '../../shared/cryptography/cryptography.service';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import {
  EthereumTransactionParams,
  IWallet,
  SolanaTransactionParams,
  WalletFactory,
} from '../../shared/wallets/Iwallet.types';
import { AdminWithdrawalsService } from '../admin/withdrawals/admin-withdrawals.service';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { BlockchainService } from './blockchain.service';

interface ConfirmationMonitoringData {
  withdrawalId: string;
  transactionHash: string;
  blockchain: string;
  attempt: number;
}

@Injectable()
@Processor('withdrawalsQueue')
export class WithdrawalsProcessor extends WorkerHost {
  private readonly logger = new Logger(WithdrawalsProcessor.name);

  // Network-specific confirmation requirements per WM-003
  private readonly confirmationRequirements = {
    'eip155:1': 12, // Ethereum mainnet
    'eip155:56': 12, // BSC
    'bip122:000000000019d6689c085ae165831e93': 3, // Bitcoin
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 32, // Solana
  };

  // Transaction timeout (24 hours)
  private readonly TRANSACTION_TIMEOUT_MS = 24 * 60 * 60 * 1000;

  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly blockchainService: BlockchainService,
    private readonly adminWithdrawalsService: AdminWithdrawalsService,
    private readonly walletFactory: WalletFactory,
    private readonly configService: AppConfigService,
    private readonly cryptographyService: CryptographyService,
    @InjectQueue('withdrawalsQueue')
    private readonly withdrawalsQueue: Queue<WithdrawalProcessingData | ConfirmationMonitoringData>,
  ) {
    super();
  }

  async process(job: Job) {
    switch (job.name) {
      case 'process-withdrawal':
        return this.processWithdrawal(job as Job<WithdrawalProcessingData>);
      case 'monitor-confirmation':
        return this.monitorConfirmation(job as Job<ConfirmationMonitoringData>);
      default:
        invariant(false, `Unknown job type: ${job.name}`);
    }
  }

  private async processWithdrawal(job: Job<WithdrawalProcessingData>) {
    const {
      withdrawalId,
      amount,
      currencyBlockchainKey,
      currencyTokenId,
      beneficiaryAddress,
      userId,
    } = job.data;

    this.logger.log(`[WM-003] Processing withdrawal: ${withdrawalId}, Amount: ${amount}`);

    try {
      // 1. Re-validate withdrawal state and balances (WM-003 Step 1)
      const validation = await this.validateWithdrawalForProcessing(withdrawalId, userId);
      if (!validation.valid) {
        return { status: 'skipped', reason: validation.reason };
      }

      // 2. Check blockchain network operational status
      const networkStatus =
        await this.blockchainService.isNetworkOperational(currencyBlockchainKey);
      invariant(
        networkStatus.operational,
        `Blockchain network ${currencyBlockchainKey} is not operational: ${networkStatus.reason}`,
      );

      // 3. Estimate current network transaction fees
      const feeEstimate = await this.blockchainService.estimateNetworkFee(
        currencyBlockchainKey,
        currencyTokenId,
        { priority: 'standard' },
      );

      // 4. Validate destination address reachability
      const addressValidation = await this.validateDestinationAddress(
        beneficiaryAddress,
        currencyBlockchainKey,
      );
      invariant(
        addressValidation.valid,
        `Destination address validation failed: ${addressValidation.reason}`,
      );

      // 5. Execute blockchain transaction (WM-003 Step 2)
      const transactionResult = await this.executeBlockchainTransaction({
        withdrawalId,
        amount,
        currencyBlockchainKey,
        currencyTokenId,
        beneficiaryAddress,
        estimatedFee: feeEstimate.fee.toString(),
      });

      if (transactionResult.success) {
        // 6. Update withdrawal status to 'Sent'
        await this.repo.platformSendsWithdrawal({
          withdrawalId,
          sentAmount: transactionResult.sentAmount!,
          sentHash: transactionResult.transactionHash!,
          sentDate: new Date(),
        });

        // 7. Queue confirmation monitoring (WM-003 Step 3)
        await this.queueConfirmationMonitoring(
          withdrawalId,
          transactionResult.transactionHash!,
          currencyBlockchainKey,
        );

        // 8. Send user notification
        await this.notificationQueueService.queueNotification({
          type: 'WithdrawalSent',
          name: 'Withdrawal Sent',
          withdrawalId,
          transactionHash: transactionResult.transactionHash,
          blockchainNetwork: currencyBlockchainKey,
          estimatedConfirmationTime: this.getEstimatedConfirmationTime(currencyBlockchainKey),
        } as any);

        this.logger.log(
          `[WM-003] Withdrawal ${withdrawalId} sent successfully. Hash: ${transactionResult.transactionHash}`,
        );

        return {
          status: 'sent',
          transactionHash: transactionResult.transactionHash,
          sentAmount: transactionResult.sentAmount,
        };
      } else {
        await this.handleWithdrawalFailure(
          withdrawalId,
          transactionResult.error!,
          'BLOCKCHAIN_EXECUTION_FAILED',
        );
        invariant(false, `Blockchain transaction failed: ${transactionResult.error}`);
      }
    } catch (error) {
      this.logger.error(`[WM-003] Failed to process withdrawal ${withdrawalId}:`, error);

      // Mark as failed if this is the final attempt
      if (job.attemptsMade >= (job.opts?.attempts || 5)) {
        await this.handleWithdrawalFailure(withdrawalId, error.message, 'MAX_RETRIES_EXCEEDED');
      }

      throw error;
    }
  }

  private async monitorConfirmation(job: Job<ConfirmationMonitoringData>) {
    const { withdrawalId, transactionHash, blockchain, attempt = 1 } = job.data;

    this.logger.log(
      `[WM-003] Monitoring confirmation for withdrawal ${withdrawalId}, hash: ${transactionHash}, attempt: ${attempt}`,
    );

    try {
      // Get withdrawal details for system monitoring
      // Using empty userId as system operation
      const { withdrawal } = await this.repo.userViewsWithdrawalDetails({
        userId: '',
        withdrawalId,
      });

      if (!withdrawal || withdrawal.state !== 'sent') {
        const currentState = withdrawal?.state || 'not found';
        this.logger.warn(
          `[WM-003] Withdrawal ${withdrawalId} is not in sent state: ${currentState}`,
        );
        return { status: 'skipped', reason: `Withdrawal state is ${currentState}` };
      }

      // Check for transaction timeout (24 hours)
      if (withdrawal.sentDate) {
        const sentDate = new Date(withdrawal.sentDate);
        const now = new Date();
        if (now.getTime() - sentDate.getTime() > this.TRANSACTION_TIMEOUT_MS) {
          await this.handleTransactionTimeout(withdrawalId, transactionHash);
          return { status: 'timeout', reason: 'Transaction timeout (24 hours)' };
        }
      }

      // Query blockchain for transaction status
      const confirmationStatus = await this.checkTransactionConfirmation(
        transactionHash,
        blockchain,
      );

      const requiredConfirmations = this.confirmationRequirements[blockchain] || 12;

      if (
        confirmationStatus.confirmed &&
        confirmationStatus.confirmations >= requiredConfirmations
      ) {
        // Transaction confirmed
        await this.repo.platformConfirmsWithdrawal({
          withdrawalId,
          confirmedDate: new Date(),
        });

        // Send success notification
        await this.notificationQueueService.queueNotification({
          type: 'WithdrawalConfirmed',
          name: 'Withdrawal Confirmed',
          withdrawalId,
          transactionHash,
          confirmations: confirmationStatus.confirmations,
        } as any);

        this.logger.log(
          `[WM-003] Withdrawal ${withdrawalId} confirmed with ${confirmationStatus.confirmations} confirmations`,
        );

        return { status: 'confirmed', confirmations: confirmationStatus.confirmations };
      } else if (confirmationStatus.failed) {
        // Transaction failed or reverted
        await this.handleTransactionFailure(
          withdrawalId,
          transactionHash,
          confirmationStatus.failureReason || 'Unknown failure reason',
        );
        return { status: 'failed', reason: confirmationStatus.failureReason };
      } else {
        // Still pending, requeue for next check
        await this.requeueConfirmationMonitoring(
          withdrawalId,
          transactionHash,
          blockchain,
          attempt + 1,
        );
        return {
          status: 'pending',
          confirmations: confirmationStatus.confirmations,
          required: requiredConfirmations,
        };
      }
    } catch (error) {
      this.logger.error(`[WM-003] Error monitoring confirmation for ${withdrawalId}:`, error);

      // Requeue with exponential backoff, max 20 attempts
      if (attempt < 20) {
        await this.requeueConfirmationMonitoring(
          withdrawalId,
          transactionHash,
          blockchain,
          attempt + 1,
        );
      } else {
        await this.handleMonitoringFailure(withdrawalId, transactionHash, error.message);
      }

      throw error;
    }
  }

  // WM-003 Step 1: Validation methods
  private async validateWithdrawalForProcessing(
    withdrawalId: string,
    userId: string,
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      const { withdrawal } = await this.repo.userViewsWithdrawalDetails({ userId, withdrawalId });

      if (!withdrawal) {
        return { valid: false, reason: 'Withdrawal not found' };
      }

      if (withdrawal.state !== 'requested') {
        return { valid: false, reason: `Withdrawal state is ${withdrawal.state}` };
      }

      // Re-validate account balance sufficiency
      // This would check if user still has sufficient balance
      // TODO: Implement actual balance validation

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: `Validation error: ${error.message}` };
    }
  }

  private async validateDestinationAddress(
    address: string,
    blockchain: string,
  ): Promise<{
    valid: boolean;
    reason?: string;
  }> {
    try {
      // Validate address format based on blockchain type
      if (blockchain.startsWith('eip155:')) {
        // Ethereum-compatible address validation
        if (!ethers.isAddress(address)) {
          return {
            valid: false,
            reason: 'Invalid Ethereum address format',
          };
        }

        // Check if it's a contract address (optional additional validation)
        // In production, you might want to verify if contract addresses are expected
        return { valid: true };
      } else if (blockchain.startsWith('solana:')) {
        // Solana address validation
        // Solana addresses are base58 encoded and 32 bytes (44 characters)
        if (address.length < 32 || address.length > 44) {
          return {
            valid: false,
            reason: 'Invalid Solana address length',
          };
        }

        // Basic base58 character validation
        const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
        if (!base58Regex.test(address)) {
          return {
            valid: false,
            reason: 'Invalid Solana address format',
          };
        }

        return { valid: true };
      } else if (blockchain.startsWith('bip122:')) {
        // Bitcoin address validation
        // Basic validation for P2PKH, P2SH, and Bech32 addresses
        const bitcoinAddressRegex = /^([13][a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59})$/;
        if (!bitcoinAddressRegex.test(address)) {
          return {
            valid: false,
            reason: 'Invalid Bitcoin address format',
          };
        }

        return { valid: true };
      }

      return {
        valid: false,
        reason: `Address validation not implemented for blockchain: ${blockchain}`,
      };
    } catch (error) {
      this.logger.error(`Address validation error for ${blockchain}:`, error);
      return {
        valid: false,
        reason: `Address validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  // WM-003 Step 2: Blockchain execution
  private async executeBlockchainTransaction(params: {
    withdrawalId: string;
    amount: string;
    currencyBlockchainKey: string;
    currencyTokenId: string;
    beneficiaryAddress: string;
    estimatedFee: string;
  }): Promise<{
    success: boolean;
    transactionHash?: string;
    sentAmount?: string;
    error?: string;
  }> {
    this.logger.log(
      `[WM-003] Executing blockchain transaction for withdrawal ${params.withdrawalId}`,
    );

    try {
      // 1. Load platform wallet securely
      const platformWallet = await this.getPlatformWallet(params.currencyBlockchainKey);

      // 2. Calculate precise transaction fee and validate amount
      const feeValidation = await this.validateTransactionFees(params);
      if (!feeValidation.valid) {
        return {
          success: false,
          error: `Fee validation failed: ${feeValidation.reason}`,
        };
      }

      // 3. Construct transaction based on blockchain type
      const transactionData = await this.constructTransaction(params, platformWallet);

      // 4. Sign the transaction
      const signedTransaction = await platformWallet.signTransaction(transactionData);

      // 5. Submit to blockchain network
      const result = await platformWallet.sendTransaction(signedTransaction);

      // 6. Validate transaction result
      if (this.isSuccessfulTransaction(result)) {
        const actualFee = feeValidation.actualFee || parseFloat(params.estimatedFee);
        const sentAmount = (parseFloat(params.amount) - actualFee).toString();

        return {
          success: true,
          transactionHash: this.extractTransactionHash(result),
          sentAmount,
        };
      } else {
        return {
          success: false,
          error: this.extractTransactionError(result),
        };
      }
    } catch (error) {
      this.logger.error(`[WM-003] Transaction execution failed for ${params.withdrawalId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown blockchain error',
      };
    }
  }

  // WM-003 Step 3: Confirmation monitoring
  private async checkTransactionConfirmation(
    _transactionHash: string,
    blockchain: string,
  ): Promise<{
    confirmed: boolean;
    confirmations: number;
    failed?: boolean;
    failureReason?: string;
  }> {
    // TODO: Implement actual blockchain transaction status checking
    // This would query the blockchain for transaction receipt and confirmations

    // Simulate confirmation status
    const confirmations = Math.floor(Math.random() * 20);
    const failed = Math.random() < 0.01; // 1% failure rate

    if (failed) {
      return {
        confirmed: false,
        confirmations: 0,
        failed: true,
        failureReason: 'Transaction reverted due to insufficient gas',
      };
    }

    const requiredConfirmations = this.confirmationRequirements[blockchain] || 12;

    return {
      confirmed: confirmations >= requiredConfirmations,
      confirmations,
      failed: false,
    };
  }

  // Platform Wallet Management
  private async getPlatformWallet(blockchainKey: string): Promise<IWallet> {
    try {
      // Get platform master seed securely from config
      const platformSeed = await this.getSecurePlatformSeed();
      const masterKey = HDKey.fromMasterSeed(platformSeed);

      // Get wallet service for the specific blockchain
      const walletService = this.walletFactory.getWalletService(blockchainKey);

      // Get the hot wallet (platform's operational wallet)
      return await walletService.getHotWallet(masterKey);
    } catch (error) {
      this.logger.error(`Failed to load platform wallet for ${blockchainKey}:`, error);
      throw new Error(
        `Platform wallet unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async getSecurePlatformSeed(): Promise<Buffer> {
    const walletConfig = this.configService.walletConfig;
    const cryptoConfig = this.configService.cryptographyConfig;

    // In test mode, allow mnemonic-based seed generation
    if (walletConfig.enableTestMode && walletConfig.platformMasterMnemonic) {
      this.logger.warn('Using test mode platform seed - NOT for production use');
      const seed = await mnemonicToSeed(walletConfig.platformMasterMnemonic);
      return Buffer.from(seed);
    }

    try {
      // Production mode: Use Vault for secure seed management
      if (cryptoConfig.engine === 'vault') {
        this.logger.log('Retrieving platform seed from Vault');

        // Get encrypted seed from Vault
        const secretData = await this.cryptographyService.getSecret('wallet/platform-seed');

        if (!secretData || typeof secretData !== 'object') {
          throw new Error('Platform seed not found in Vault');
        }

        const secretObj = secretData as Record<string, unknown>;
        const encryptedSeed = secretObj.encrypted_seed as string;

        if (!encryptedSeed) {
          throw new Error('Encrypted seed not found in Vault secret');
        }

        // Decrypt using Vault Transit engine
        const decryptResult = await this.cryptographyService.decrypt(
          'platform-wallet',
          encryptedSeed,
        );
        const seedHex = decryptResult.plaintext;

        // Convert from hex to Buffer
        return Buffer.from(seedHex, 'hex');
      } else {
        // Local encryption fallback (less secure)
        if (!walletConfig.platformSeedEncrypted || !walletConfig.platformSeedEncryptionKey) {
          throw new Error('Platform seed configuration missing - security critical');
        }

        // TODO: Implement local AES-256-GCM decryption
        throw new Error('Local encryption not yet implemented - use Vault for production');
      }
    } catch (error) {
      this.logger.error('Failed to retrieve platform seed:', error);
      throw new Error(
        `Platform seed access failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private async validateTransactionFees(params: {
    amount: string;
    currencyBlockchainKey: string;
    currencyTokenId: string;
    estimatedFee: string;
  }): Promise<{
    valid: boolean;
    reason?: string;
    actualFee?: number;
  }> {
    try {
      // Get current network fee estimate
      const currentFeeEstimate = await this.blockchainService.estimateNetworkFee(
        params.currencyBlockchainKey,
        params.currencyTokenId,
        { priority: 'standard' },
      );

      const estimatedFee = parseFloat(params.estimatedFee);
      const currentFee = currentFeeEstimate.fee;
      const amount = parseFloat(params.amount);

      // Check if fee estimate is still reasonable (within 50% of current)
      const feeVarianceThreshold = 0.5; // 50%
      const feeVariance = Math.abs(currentFee - estimatedFee) / estimatedFee;

      if (feeVariance > feeVarianceThreshold) {
        return {
          valid: false,
          reason: `Fee variance too high: estimated ${estimatedFee}, current ${currentFee}`,
        };
      }

      // Check if amount is sufficient to cover fee
      if (amount <= currentFee) {
        return {
          valid: false,
          reason: `Insufficient amount to cover fees: ${amount} <= ${currentFee}`,
        };
      }

      return {
        valid: true,
        actualFee: currentFee,
      };
    } catch (error) {
      this.logger.error('Fee validation failed:', error);
      return {
        valid: false,
        reason: `Fee validation error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  private async constructTransaction(
    params: {
      amount: string;
      currencyBlockchainKey: string;
      currencyTokenId: string;
      beneficiaryAddress: string;
      estimatedFee: string;
    },
    wallet: IWallet,
  ): Promise<unknown> {
    const amount = parseFloat(params.amount);
    const fee = parseFloat(params.estimatedFee);
    const sendAmount = amount - fee;

    // Construct transaction data based on blockchain type
    if (params.currencyBlockchainKey.startsWith('eip155:')) {
      // Ethereum-compatible chains (Ethereum, BSC, Polygon)
      const isNative = !params.currencyTokenId || params.currencyTokenId === 'native';

      if (isNative) {
        // Native currency transfer (ETH, BNB, etc.)
        return {
          params: {
            to: params.beneficiaryAddress,
            value: sendAmount.toString(),
            gasLimit: 21000,
          } as EthereumTransactionParams,
        };
      } else {
        // ERC-20 token transfer
        const tokenTransferData = this.encodeERC20Transfer(
          params.beneficiaryAddress,
          ethers.parseUnits(sendAmount.toString(), 18), // Assume 18 decimals
        );

        return {
          params: {
            to: params.currencyTokenId, // Token contract address
            value: '0', // No ETH value for token transfer
            gasLimit: 65000, // Higher gas limit for token transfers
            data: tokenTransferData,
          } as EthereumTransactionParams,
        };
      }
    } else if (params.currencyBlockchainKey.startsWith('solana:')) {
      // Solana transaction
      return {
        params: {
          to: params.beneficiaryAddress,
          amount: sendAmount,
          memo: `Withdrawal ${params.amount}`,
        } as SolanaTransactionParams,
      };
    } else if (params.currencyBlockchainKey.startsWith('bip122:')) {
      // Bitcoin transaction
      // TODO: Implement Bitcoin transaction construction
      throw new Error('Bitcoin transactions not yet implemented');
    }

    throw new Error(`Unsupported blockchain: ${params.currencyBlockchainKey}`);
  }

  private encodeERC20Transfer(to: string, amount: bigint): string {
    // ERC-20 transfer function signature: transfer(address,uint256)
    const functionSignature = '0xa9059cbb';
    const addressParam = ethers.AbiCoder.defaultAbiCoder().encode(['address'], [to]);
    const amountParam = ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [amount]);

    return functionSignature + addressParam.slice(2) + amountParam.slice(2);
  }

  private isSuccessfulTransaction(result: unknown): boolean {
    if (!result || typeof result !== 'object') return false;
    const resultObj = result as Record<string, unknown>;
    return resultObj.success === true && typeof resultObj.transactionHash === 'string';
  }

  private extractTransactionHash(result: unknown): string {
    if (!result || typeof result !== 'object') return '';
    const resultObj = result as Record<string, unknown>;
    return typeof resultObj.transactionHash === 'string' ? resultObj.transactionHash : '';
  }

  private extractTransactionError(result: unknown): string {
    if (!result || typeof result !== 'object') return 'Unknown transaction error';
    const resultObj = result as Record<string, unknown>;
    return typeof resultObj.error === 'string'
      ? resultObj.error
      : 'Transaction failed without specific error';
  }

  private getEstimatedConfirmationTime(blockchain: string): string {
    const confirmationTimes = {
      'eip155:1': '15-30 minutes', // Ethereum mainnet
      'eip155:56': '3-5 minutes', // BSC
      'eip155:137': '5-10 minutes', // Polygon
      bitcoin: '30-60 minutes', // Bitcoin
      solana: '30-60 seconds', // Solana
    };

    return confirmationTimes[blockchain] || '10-20 minutes';
  }

  // WM-003 Step 4: Failure handling
  private async handleWithdrawalFailure(
    withdrawalId: string,
    reason: string,
    failureType: string,
  ): Promise<void> {
    try {
      this.logger.error(
        `[WM-003] Handling withdrawal failure: ${withdrawalId}, Type: ${failureType}, Reason: ${reason}`,
      );

      // Update withdrawal status to failed
      await this.repo.platformFailsWithdrawal({
        withdrawalId,
        failedDate: new Date(),
        failureReason: `${failureType}: ${reason}`,
      });

      // WM-004 Step 1: Create administrative notification
      const mappedFailureType = this.mapFailureTypeToString(failureType);
      await this.notificationQueueService.queueNotification({
        type: 'AdminWithdrawalFailure',
        name: 'Withdrawal Failure Alert',
        withdrawalId,
        failureType: mappedFailureType,
        failureReason: `${failureType}: ${reason}`,
        recommendedAction: this.getRecommendedAction(mappedFailureType, reason),
        priority: this.getFailurePriority(mappedFailureType),
        requiresAction: true,
        reviewLink: `/admin/withdrawals/failed/${withdrawalId}`,
      } as any);

      // Send user notification
      await this.notificationQueueService.queueNotification({
        type: 'WithdrawalFailed',
        name: 'Withdrawal Failed',
        withdrawalId,
        failureReason: 'Technical issue occurred during processing',
        nextSteps: 'Our team has been notified. You can request a refund or contact support.',
      } as any);

      this.logger.log(
        `[WM-003] Withdrawal ${withdrawalId} marked as failed and notifications sent`,
      );
    } catch (error) {
      this.logger.error(`[WM-003] Failed to handle withdrawal failure for ${withdrawalId}:`, error);
    }
  }

  private async queueConfirmationMonitoring(
    withdrawalId: string,
    transactionHash: string,
    blockchain: string,
  ): Promise<void> {
    try {
      // Calculate initial delay based on network (WM-003: monitor every 2 minutes)
      const initialDelay = this.getConfirmationMonitoringDelay(blockchain);

      await this.withdrawalsQueue.add(
        'monitor-confirmation',
        {
          withdrawalId,
          transactionHash,
          blockchain,
          attempt: 1,
        },
        {
          delay: initialDelay,
          priority: 6,
          attempts: 20,
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      );

      this.logger.log(
        `[WM-003] Queued confirmation monitoring for withdrawal ${withdrawalId}, delay: ${initialDelay}ms`,
      );
    } catch (error) {
      this.logger.error(
        `[WM-003] Failed to queue confirmation monitoring for ${withdrawalId}:`,
        error,
      );
    }
  }

  private async requeueConfirmationMonitoring(
    withdrawalId: string,
    transactionHash: string,
    blockchain: string,
    attempt: number,
  ): Promise<void> {
    try {
      // Exponential backoff with base delay of 2 minutes (120 seconds)
      const baseDelay = 2 * 60 * 1000; // 2 minutes
      const delay = Math.min(baseDelay * Math.pow(1.5, attempt - 1), 10 * 60 * 1000); // Max 10 minutes

      await this.withdrawalsQueue.add(
        'monitor-confirmation',
        {
          withdrawalId,
          transactionHash,
          blockchain,
          attempt,
        },
        {
          delay,
          priority: 6,
          attempts: 1,
          removeOnComplete: 50,
          removeOnFail: 20,
        },
      );

      this.logger.log(
        `[WM-003] Requeued confirmation monitoring for withdrawal ${withdrawalId}, attempt: ${attempt}, delay: ${delay}ms`,
      );
    } catch (error) {
      this.logger.error(
        `[WM-003] Failed to requeue confirmation monitoring for ${withdrawalId}:`,
        error,
      );
    }
  }

  private async handleTransactionTimeout(
    withdrawalId: string,
    transactionHash: string,
  ): Promise<void> {
    try {
      this.logger.warn(
        `[WM-003] Transaction timeout (24 hours) for withdrawal ${withdrawalId}, hash: ${transactionHash}`,
      );

      await this.repo.platformFailsWithdrawal({
        withdrawalId,
        failedDate: new Date(),
        failureReason: 'Transaction timeout - no confirmation received within 24 hours',
      });

      // WM-004 Step 1: Create administrative notification for timeout
      await this.notificationQueueService.queueNotification({
        type: 'AdminWithdrawalFailure',
        name: 'Withdrawal Failure Alert',
        withdrawalId,
        failureType: 'TRANSACTION_TIMEOUT',
        failureReason: 'Transaction timeout - no confirmation received within 24 hours',
        recommendedAction: 'Review for potential refund - likely network congestion',
        priority: 'high',
        requiresAction: true,
        reviewLink: `/admin/withdrawals/failed/${withdrawalId}`,
      } as any);

      // User notification
      await this.notificationQueueService.queueNotification({
        type: 'WithdrawalTimeout',
        name: 'Withdrawal Processing Delayed',
        withdrawalId,
        message: 'Your withdrawal is taking longer than expected. Our team is investigating.',
      } as any);
    } catch (error) {
      this.logger.error(
        `[WM-003] Failed to handle transaction timeout for ${withdrawalId}:`,
        error,
      );
    }
  }

  private async handleTransactionFailure(
    withdrawalId: string,
    transactionHash: string,
    failureReason: string,
  ): Promise<void> {
    try {
      this.logger.error(
        `[WM-003] Transaction failure detected: ${withdrawalId}, hash: ${transactionHash}, reason: ${failureReason}`,
      );

      await this.repo.platformFailsWithdrawal({
        withdrawalId,
        failedDate: new Date(),
        failureReason: `Transaction failed: ${failureReason}`,
      });

      // WM-004 Step 1: Create administrative notification for transaction failure
      await this.adminWithdrawalsService.createFailureNotification(
        withdrawalId,
        `Transaction failed: ${failureReason}`,
        'BLOCKCHAIN_REJECTION' as any, // FailureType enum
      );

      // TODO: Initiate automatic refund process as per WM-003
      // This would queue a refund job in a separate refund queue
      this.logger.log(`[WM-003] Automatic refund required for withdrawal ${withdrawalId}`);
    } catch (error) {
      this.logger.error(
        `[WM-003] Failed to handle transaction failure for ${withdrawalId}:`,
        error,
      );
    }
  }

  private async handleMonitoringFailure(
    withdrawalId: string,
    transactionHash: string,
    error: string,
  ): Promise<void> {
    try {
      this.logger.error(
        `[WM-003] Monitoring failure after max attempts: ${withdrawalId}, hash: ${transactionHash}, error: ${error}`,
      );

      // Admin notification for monitoring failure
      await this.notificationQueueService.queueNotification({
        type: 'AdminMonitoringFailure',
        name: 'Confirmation Monitoring Failed',
        withdrawalId,
        transactionHash,
        error,
        requiresManualCheck: true,
      } as any);
    } catch (notificationError) {
      this.logger.error(
        `[WM-003] Failed to send monitoring failure notification for ${withdrawalId}:`,
        notificationError,
      );
    }
  }

  private getConfirmationMonitoringDelay(blockchain: string): number {
    // Initial delay before first confirmation check
    const delays = {
      'eip155:1': 5 * 60 * 1000, // Ethereum: 5 minutes
      'eip155:56': 30 * 1000, // BSC: 30 seconds
      'eip155:137': 60 * 1000, // Polygon: 1 minute
      bitcoin: 10 * 60 * 1000, // Bitcoin: 10 minutes
      solana: 15 * 1000, // Solana: 15 seconds
    };

    return delays[blockchain] || 2 * 60 * 1000; // Default: 2 minutes
  }

  private mapFailureTypeToString(failureType: string): string {
    const type = failureType.toUpperCase();

    if (type.includes('TIMEOUT')) return 'TRANSACTION_TIMEOUT';
    if (type.includes('NETWORK')) return 'NETWORK_ERROR';
    if (type.includes('BLOCKCHAIN') && type.includes('REJECTION')) return 'BLOCKCHAIN_REJECTION';
    if (type.includes('INSUFFICIENT')) return 'INSUFFICIENT_FUNDS';
    if (type.includes('ADDRESS')) return 'INVALID_ADDRESS';
    if (type.includes('USER')) return 'USER_ERROR';

    return 'SYSTEM_ERROR'; // Default fallback
  }

  private getRecommendedAction(failureType: string, _failureReason: string): string {
    switch (failureType) {
      case 'TRANSACTION_TIMEOUT':
        return 'Review for potential refund - likely network congestion';
      case 'NETWORK_ERROR':
        return 'Check network status and consider refund if platform issue';
      case 'BLOCKCHAIN_REJECTION':
        return 'Investigate blockchain error - may require refund';
      case 'INSUFFICIENT_FUNDS':
        return 'Check platform wallet balance - investigate fund management';
      case 'INVALID_ADDRESS':
        return 'Verify if address validation failed - user error likely';
      case 'USER_ERROR':
        return 'Review user actions - refund may not be appropriate';
      case 'SYSTEM_ERROR':
      default:
        return 'Investigate system error - platform responsibility likely';
    }
  }

  private getFailurePriority(failureType: string): 'low' | 'medium' | 'high' | 'critical' {
    switch (failureType) {
      case 'SYSTEM_ERROR':
      case 'INSUFFICIENT_FUNDS':
        return 'critical';
      case 'TRANSACTION_TIMEOUT':
      case 'NETWORK_ERROR':
      case 'BLOCKCHAIN_REJECTION':
        return 'high';
      case 'INVALID_ADDRESS':
        return 'medium';
      case 'USER_ERROR':
        return 'low';
      default:
        return 'medium';
    }
  }
}
