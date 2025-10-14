import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { Spot } from '@binance/connector';

export interface BinanceBalance {
  asset: string;
  free: string;
  locked: string;
}

export interface BinanceDepositAddress {
  address: string;
  tag?: string;
  coin: string;
  network: string;
}

export interface BinanceWithdrawalResult {
  id: string;
  withdrawOrderId?: string;
  amount: string;
  transactionFee: string;
  address: string;
  asset: string;
  txId?: string;
  applyTime: string;
  status: number;
}

@Injectable()
export class BinanceClientService {
  private readonly logger = new Logger(BinanceClientService.name);
  private client: Spot | null = null;
  private isEnabled: boolean;

  constructor(private readonly configService: ConfigService) {
    this.isEnabled = this.configService.get<boolean>('BINANCE_API_ENABLED', false);

    if (this.isEnabled) {
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      const isDevelopment = nodeEnv === 'development';

      // In development mode, use test API keys; in production, use main keys
      const apiKey = isDevelopment
        ? this.configService.get<string>('BINANCE_TEST_API_KEY')
        : this.configService.get<string>('BINANCE_API_KEY');

      const apiSecret = isDevelopment
        ? this.configService.get<string>('BINANCE_TEST_API_SECRET')
        : this.configService.get<string>('BINANCE_API_SECRET');

      if (!apiKey || !apiSecret) {
        this.logger.warn(
          `Binance API credentials not configured for ${nodeEnv} mode - Binance integration disabled`,
        );
        this.isEnabled = false;
      } else {
        const baseURL = this.configService.get<string>(
          'BINANCE_API_BASE_URL',
          'https://api.binance.com',
        );

        this.client = new Spot(apiKey, apiSecret, { baseURL });
        this.logger.log(
          `Binance API client initialized successfully (${nodeEnv} mode using ${isDevelopment ? 'test' : 'production'} credentials)`,
        );
      }
    } else {
      this.logger.warn('Binance API integration is disabled via configuration');
    }
  }

  /**
   * Check if Binance API is enabled and configured
   */
  isApiEnabled(): boolean {
    return this.isEnabled && this.client !== null;
  }

  /**
   * Get account information including all balances
   */
  async getAccountInfo(): Promise<{ balances: BinanceBalance[] }> {
    if (!this.client) {
      throw new Error('Binance API client not initialized');
    }

    try {
      this.logger.debug('Fetching Binance account information...');
      const response = await this.client.account();
      const accountInfo = response.data;

      return {
        balances: accountInfo.balances
          .filter((b: any) => Number.parseFloat(b.free) > 0 || Number.parseFloat(b.locked) > 0)
          .map((b: any) => ({
            asset: b.asset,
            free: b.free,
            locked: b.locked,
          })),
      };
    } catch (error) {
      this.logger.error('Failed to fetch Binance account info:', error);
      throw error;
    }
  }

  /**
   * Get balance for a specific asset
   */
  async getAssetBalance(asset: string): Promise<BinanceBalance | null> {
    if (!this.client) {
      throw new Error('Binance API client not initialized');
    }

    try {
      this.logger.debug(`Fetching balance for ${asset}...`);
      const response = await this.client.account();
      const accountInfo = response.data;

      const balance = accountInfo.balances.find((b: any) => b.asset === asset);

      if (!balance) {
        this.logger.debug(`No balance found for ${asset}`);
        return null;
      }

      return {
        asset: balance.asset,
        free: balance.free,
        locked: balance.locked,
      };
    } catch (error) {
      this.logger.error(`Failed to fetch balance for ${asset}:`, error);
      throw error;
    }
  }

  /**
   * Get deposit address for a specific coin and network
   * @param coin - The coin/asset symbol (e.g., 'USDT')
   * @param network - The network (e.g., 'BSC', 'ETH', 'TRX')
   */
  async getDepositAddress(coin: string, network?: string): Promise<BinanceDepositAddress> {
    if (!this.client) {
      throw new Error('Binance API client not initialized');
    }

    try {
      this.logger.debug(
        `Fetching deposit address for ${coin} on network ${network || 'default'}...`,
      );

      const params: any = { coin };
      if (network) {
        params.network = network;
      }

      const response = await this.client.depositAddress(coin, params);
      const data = response.data;

      return {
        address: data.address,
        tag: data.tag,
        coin: data.coin,
        network: data.network || network || 'unknown',
      };
    } catch (error) {
      this.logger.error(`Failed to get deposit address for ${coin}:`, error);
      throw error;
    }
  }

  /**
   * Get deposit history
   */
  async getDepositHistory(coin?: string, startTime?: number, endTime?: number): Promise<any[]> {
    if (!this.client) {
      throw new Error('Binance API client not initialized');
    }

    try {
      this.logger.debug(`Fetching deposit history for ${coin || 'all coins'}...`);

      const params: any = {};
      if (coin) params.coin = coin;
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await this.client.depositHistory(params);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch deposit history:', error);
      throw error;
    }
  }

  /**
   * Withdraw funds from Binance to an external address
   * @param coin - The coin/asset symbol
   * @param address - Destination address
   * @param amount - Amount to withdraw
   * @param network - Network to use (e.g., 'BSC', 'ETH', 'TRX')
   * @param addressTag - Optional address tag/memo (for coins like XRP, XLM)
   */
  async withdraw(
    coin: string,
    address: string,
    amount: string,
    network?: string,
    addressTag?: string,
  ): Promise<BinanceWithdrawalResult> {
    if (!this.client) {
      throw new Error('Binance API client not initialized');
    }

    try {
      this.logger.log(
        `Initiating withdrawal: ${amount} ${coin} to ${address} on ${network || 'default'} network`,
      );

      const params: any = {
        coin,
        address,
        amount: Number.parseFloat(amount),
      };

      if (network) params.network = network;
      if (addressTag) params.addressTag = addressTag;

      const response = await this.client.withdraw(coin, address, Number.parseFloat(amount), params);
      const result = response.data;

      this.logger.log(`Withdrawal successful - ID: ${result.id}`);

      return {
        id: result.id,
        withdrawOrderId: result.id,
        amount: amount,
        transactionFee: '0', // Fee info might not be in response
        address,
        asset: coin,
        txId: undefined, // TxId comes later
        applyTime: new Date().toISOString(),
        status: 0, // Pending
      };
    } catch (error) {
      this.logger.error(`Failed to withdraw ${coin}:`, error);
      throw error;
    }
  }

  /**
   * Get withdrawal history
   */
  async getWithdrawalHistory(coin?: string, startTime?: number, endTime?: number): Promise<any[]> {
    if (!this.client) {
      throw new Error('Binance API client not initialized');
    }

    try {
      this.logger.debug(`Fetching withdrawal history for ${coin || 'all coins'}...`);

      const params: any = {};
      if (coin) params.coin = coin;
      if (startTime) params.startTime = startTime;
      if (endTime) params.endTime = endTime;

      const response = await this.client.withdrawHistory(params);
      return response.data;
    } catch (error) {
      this.logger.error('Failed to fetch withdrawal history:', error);
      throw error;
    }
  }

  /**
   * Check withdrawal status
   * @param withdrawId - The withdrawal ID returned from withdraw()
   */
  async getWithdrawalStatus(withdrawId: string): Promise<any> {
    if (!this.client) {
      throw new Error('Binance API client not initialized');
    }

    try {
      this.logger.debug(`Checking withdrawal status for ID: ${withdrawId}`);

      const response = await this.client.withdrawHistory({});
      const withdrawals = response.data;
      const withdrawal = withdrawals.find((w: any) => w.id === withdrawId);

      if (!withdrawal) {
        throw new Error(`Withdrawal with ID ${withdrawId} not found`);
      }

      return withdrawal;
    } catch (error) {
      this.logger.error(`Failed to get withdrawal status for ${withdrawId}:`, error);
      throw error;
    }
  }

  /**
   * Get system status
   */
  async getSystemStatus(): Promise<{ status: number; msg: string }> {
    if (!this.client) {
      throw new Error('Binance API client not initialized');
    }

    try {
      const response = await this.client.systemStatus();
      return response.data;
    } catch (error) {
      this.logger.error('Failed to get system status:', error);
      throw error;
    }
  }

  /**
   * Test connectivity to Binance API
   */
  async ping(): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      await this.client.ping();
      return true;
    } catch (error) {
      this.logger.error('Binance API ping failed:', error);
      return false;
    }
  }
}
