import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { BinanceClientService } from './binance-client.service';
import { BinanceWalletDepositService } from './binance-wallet-deposit.service';

export interface DepositToBinanceParams {
  blockchain: string;
  asset: string;
  amount: string;
}

export interface DepositToBinanceResult {
  success: boolean;
  txHash?: string;
  binanceDepositAddress: string;
  amount: string;
  asset: string;
  network: string;
  message: string;
  error?: string;
}

export interface WithdrawFromBinanceParams {
  blockchain: string;
  asset: string;
  amount: string;
  toAddress: string; // Usually the hot wallet address
}

export interface WithdrawFromBinanceResult {
  success: boolean;
  withdrawalId?: string;
  txHash?: string;
  amount: string;
  asset: string;
  network: string;
  status: string;
  message: string;
  error?: string;
}

/**
 * High-level service for settlement operations between hot wallet and Binance
 *
 * This service orchestrates:
 * 1. Deposits: Hot Wallet -> Binance Exchange
 * 2. Withdrawals: Binance Exchange -> Hot Wallet
 */
@Injectable()
export class BinanceSettlementService {
  private readonly logger = new Logger(BinanceSettlementService.name);

  constructor(
    private readonly binanceWalletDeposit: BinanceWalletDepositService,
    private readonly binanceClient: BinanceClientService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Deposit funds from hot wallet to Binance exchange
   *
   * Steps:
   * 1. Get Binance deposit address
   * 2. Use BlockchainService to send transaction from hot wallet
   * 3. Return transaction details for monitoring
   *
   * Note: Actual blockchain transaction must be done using BlockchainService
   * This method provides the information needed for that transaction
   */
  async prepareDepositToBinance(params: DepositToBinanceParams): Promise<{
    binanceDepositAddress: string;
    amount: string;
    asset: string;
    network: string;
    tag?: string;
    instructions: string[];
  }> {
    this.logger.log(
      `Preparing deposit: ${params.amount} ${params.asset} on ${params.blockchain} to Binance`,
    );

    const depositInfo = await this.binanceWalletDeposit.prepareDepositTransaction(
      params.blockchain,
      params.amount,
      params.asset,
    );

    return {
      binanceDepositAddress: depositInfo.toAddress,
      amount: depositInfo.amount,
      asset: depositInfo.asset,
      network: depositInfo.network,
      tag: depositInfo.tag,
      instructions: depositInfo.instructions,
    };
  }

  /**
   * Verify that a deposit has arrived in Binance
   *
   * @param asset - The asset that was deposited
   * @param expectedAmount - Expected deposit amount
   * @param txHash - Optional transaction hash
   * @param afterTimestamp - Only check deposits after this time (ms)
   */
  async verifyDepositToBinance(
    asset: string,
    expectedAmount: string,
    txHash?: string,
    afterTimestamp?: number,
  ): Promise<{
    verified: boolean;
    deposit?: {
      amount: string;
      txId: string;
      status: number;
      insertTime: number;
    };
    message: string;
  }> {
    this.logger.log(`Verifying deposit of ${expectedAmount} ${asset} to Binance...`);

    const result = await this.binanceWalletDeposit.verifyDeposit(
      asset,
      expectedAmount,
      txHash,
      afterTimestamp,
    );

    if (result.found && result.deposit) {
      const statusText =
        result.deposit.status === 1
          ? 'Completed'
          : result.deposit.status === 0
            ? 'Pending'
            : 'Unknown';

      return {
        verified: true,
        deposit: result.deposit,
        message: `Deposit verified: ${result.deposit.amount} ${asset} (Status: ${statusText})`,
      };
    }

    return {
      verified: false,
      message: `Deposit not found in Binance history`,
    };
  }

  /**
   * Withdraw funds from Binance exchange to hot wallet
   *
   * @param params - Withdrawal parameters
   */
  async withdrawFromBinance(params: WithdrawFromBinanceParams): Promise<WithdrawFromBinanceResult> {
    this.logger.log(
      `Initiating withdrawal: ${params.amount} ${params.asset} from Binance to ${params.toAddress}`,
    );

    try {
      // Get Binance network name
      const binanceNetwork = this.getBinanceNetwork(params.blockchain);

      // Execute withdrawal
      const result = await this.binanceClient.withdraw(
        params.asset,
        params.toAddress,
        params.amount,
        binanceNetwork,
      );

      this.logger.log(`Withdrawal successful - ID: ${result.id}`);

      return {
        success: true,
        withdrawalId: result.id,
        txHash: result.txId,
        amount: result.amount,
        asset: result.asset,
        network: binanceNetwork,
        status: this.getWithdrawalStatusText(result.status),
        message: `Withdrawal initiated successfully. ID: ${result.id}`,
      };
    } catch (error) {
      this.logger.error(`Withdrawal failed:`, error);

      return {
        success: false,
        amount: params.amount,
        asset: params.asset,
        network: this.getBinanceNetwork(params.blockchain),
        status: 'Failed',
        message: 'Withdrawal failed',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Check status of a withdrawal
   */
  async checkWithdrawalStatus(withdrawalId: string): Promise<{
    status: string;
    txHash?: string;
    amount?: string;
    asset?: string;
    completedTime?: number;
  }> {
    this.logger.debug(`Checking withdrawal status for ID: ${withdrawalId}`);

    try {
      const withdrawal = await this.binanceClient.getWithdrawalStatus(withdrawalId);

      return {
        status: this.getWithdrawalStatusText(withdrawal.status),
        txHash: withdrawal.txId,
        amount: withdrawal.amount,
        asset: withdrawal.coin,
        completedTime: withdrawal.completeTime,
      };
    } catch (error) {
      this.logger.error(`Failed to check withdrawal status:`, error);
      throw error;
    }
  }

  /**
   * Get Binance balance for settlement
   */
  async getBinanceBalance(asset: string): Promise<{
    asset: string;
    free: string;
    locked: string;
    total: string;
  }> {
    const balance = await this.binanceWalletDeposit.getBalance(asset);

    return {
      asset,
      ...balance,
    };
  }

  /**
   * Get Binance deposit address for a blockchain
   */
  async getBinanceDepositAddress(blockchain: string, asset?: string) {
    return await this.binanceWalletDeposit.getBinanceDepositAddress(blockchain, asset);
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    binanceApiEnabled: boolean;
    binanceApiOperational: boolean;
    readyForSettlement: boolean;
  }> {
    const apiStatus = await this.binanceWalletDeposit.getApiStatus();

    return {
      binanceApiEnabled: apiStatus.enabled,
      binanceApiOperational: apiStatus.operational,
      readyForSettlement: apiStatus.enabled && apiStatus.operational,
    };
  }

  /**
   * Map blockchain name to Binance network
   */
  private getBinanceNetwork(blockchain: string): string {
    switch (blockchain.toUpperCase()) {
      case 'BNB_CHAIN':
      case 'BSC':
        return 'BSC';
      case 'ETHEREUM':
      case 'ETH':
        return 'ETH';
      case 'SOLANA':
      case 'SOL':
        return 'SOL';
      default:
        throw new Error(`Unsupported blockchain for Binance: ${blockchain}`);
    }
  }

  /**
   * Convert withdrawal status code to text
   */
  private getWithdrawalStatusText(status: number): string {
    // Binance withdrawal status:
    // 0 = Email Sent
    // 1 = Cancelled
    // 2 = Awaiting Approval
    // 3 = Rejected
    // 4 = Processing
    // 5 = Failure
    // 6 = Completed
    const statusMap: Record<number, string> = {
      0: 'Email Sent',
      1: 'Cancelled',
      2: 'Awaiting Approval',
      3: 'Rejected',
      4: 'Processing',
      5: 'Failure',
      6: 'Completed',
    };

    return statusMap[status] || 'Unknown';
  }
}
