import type { Job, Queue } from 'bullmq';
import type { WithdrawalProcessingData } from './withdrawals-queue.service';

import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';

import { ethers } from 'ethers';
import invariant from 'tiny-invariant';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { PlatformConfigService } from '../../shared/services/platform-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { WalletService } from '../../shared/wallets/wallet.service';
import { FailureType } from '../admin/withdrawals/admin-withdrawal.dto';
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
  private readonly logger = new TelemetryLogger(WithdrawalsProcessor.name);

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
    private readonly platformWalletService: WalletService,
    private readonly platformConfigService: PlatformConfigService,
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
          type: 'WithdrawalRequested',
          name: 'Withdrawal Requested',
          withdrawalId,
          transactionHash: transactionResult.transactionHash,
          blockchainNetwork: currencyBlockchainKey,
          estimatedConfirmationTime: this.getEstimatedConfirmationTime(currencyBlockchainKey),
        });

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
        });

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
        return { status: 'Failed', reason: confirmationStatus.failureReason };
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
      // 1. Load platform hot wallet details
      const [hotWallet, hotWalletConfig] = await Promise.all([
        this.platformWalletService.getHotWallet(params.currencyBlockchainKey),
        this.platformConfigService.getHotWalletConfig(params.currencyBlockchainKey),
      ]);

      invariant(
        hotWallet.address === hotWalletConfig.address,
        'Hot wallet address mismatch detected',
      );

      const platformWallet = hotWallet.wallet;

      // 2. Calculate precise transaction fee and validate amount
      const feeValidation = await this.validateTransactionFees(params);
      if (!feeValidation.valid) {
        return {
          success: false,
          error: `Fee validation failed: ${feeValidation.reason}`,
        };
      }

      // 3. Calculate net amount to send (amount - fee)
      const actualFee = feeValidation.actualFee || parseFloat(params.estimatedFee);
      const sendAmount = (parseFloat(params.amount) - actualFee).toString();

      // 4. Get sender address from platform wallet (HD wallet derived address)
      const senderAddress = hotWalletConfig.address;

      // 5. Execute transfer using simplified wallet interface
      const transferParams = {
        tokenId: params.currencyTokenId,
        from: senderAddress,
        to: params.beneficiaryAddress,
        value: sendAmount,
      };

      const result = await platformWallet.transfer(transferParams);

      // 6. Return successful result
      return {
        success: true,
        transactionHash: result.txHash,
        sentAmount: sendAmount,
      };
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
        {
          priority: 'standard',
        },
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

  private getEstimatedConfirmationTime(blockchain: string): string {
    const confirmationTimes = {
      'eip155:1': '15-30 minutes', // Ethereum mainnet
      'eip155:56': '3-5 minutes', // BSC
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
      });

      // Send user notification
      await this.notificationQueueService.queueNotification({
        type: 'WithdrawalFailed',
        name: 'Withdrawal Failed',
        withdrawalId,
        failureReason: 'Technical issue occurred during processing',
        nextSteps: 'Our team has been notified. You can request a refund or contact support.',
      });

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
      });

      // User notification
      await this.notificationQueueService.queueNotification({
        type: 'WithdrawalTimeout',
        name: 'Withdrawal Processing Delayed',
        withdrawalId,
        message: 'Your withdrawal is taking longer than expected. Our team is investigating.',
      });
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
        FailureType.BLOCKCHAIN_REJECTION, // FailureType enum
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
      });
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
