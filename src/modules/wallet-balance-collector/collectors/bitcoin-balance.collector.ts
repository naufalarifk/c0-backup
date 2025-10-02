import type {
  BalanceCollectionRequest,
  BalanceCollectionResult,
} from '../balance-collection.types';

import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { WalletFactory } from '../../../shared/wallets/Iwallet.service';
import { PlatformWalletService } from '../../../shared/wallets/platform-wallet.service';
import { BlockchainNetworkEnum } from '../balance-collection.types';
import { BalanceCollector } from '../balance-collector.abstract';
import { CollectorFlag } from '../balance-collector.factory';

/**
 * Bitcoin Balance Collector for Bitcoin Mainnet
 * Handles balance collection and transfers for Bitcoin blockchain
 */
@Injectable()
@CollectorFlag(BlockchainNetworkEnum.BitcoinMainnet)
export class BitcoinBalanceCollector extends BalanceCollector {
  private readonly logger = new TelemetryLogger(BitcoinBalanceCollector.name);

  // Minimum balance to keep for transaction fees (0.0001 BTC = 10,000 satoshis)
  private readonly MIN_BALANCE_SATOSHIS = BigInt(10000);

  constructor(
    private readonly platformWalletService: PlatformWalletService,
    private readonly walletFactory: WalletFactory,
  ) {
    super();
  }

  canHandle(request: BalanceCollectionRequest): boolean {
    return request.blockchainKey === BlockchainNetworkEnum.BitcoinMainnet;
  }

  async collect(request: BalanceCollectionRequest): Promise<BalanceCollectionResult> {
    try {
      this.logger.log(`Starting Bitcoin balance collection`, {
        blockchainKey: request.blockchainKey,
        walletAddress: request.walletAddress,
      });

      // Check balance
      const balance = await this.checkBalance(request.walletAddress);
      const balanceBigInt = BigInt(balance);
      const balanceBtc = Number(balanceBigInt) / 100000000; // Convert satoshis to BTC

      this.logger.log(`Balance check: ${balanceBtc} BTC`, {
        balance,
        balanceBtc,
      });

      // Skip if balance is zero
      if (balanceBigInt <= 0n) {
        return {
          success: true,
          balance,
          skipped: true,
          skipReason: 'Zero balance',
        };
      }

      // Skip if balance is too small to cover minimum balance requirement
      if (balanceBigInt <= this.MIN_BALANCE_SATOSHIS) {
        const minBtc = Number(this.MIN_BALANCE_SATOSHIS) / 100000000;
        return {
          success: true,
          balance,
          skipped: true,
          skipReason: `Balance too small (minimum: ${minBtc} BTC for fees)`,
        };
      }

      // Get hot wallet address
      const hotWallet = await this.platformWalletService.getHotWallet(request.blockchainKey);
      const hotWalletAddress = hotWallet.address;

      // Transfer balance
      const transferResult = await this.transferToHotWallet(
        request.walletDerivationPath,
        hotWalletAddress,
        balance,
      );

      const transferredBtc = Number(BigInt(transferResult.transferredAmount)) / 100000000;

      this.logger.log(`Successfully collected ${transferredBtc} BTC`, {
        transactionHash: transferResult.txHash,
        transferredAmount: transferResult.transferredAmount,
      });

      return {
        success: true,
        balance,
        transferredAmount: transferResult.transferredAmount,
        transactionHash: transferResult.txHash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to collect Bitcoin balance: ${errorMessage}`, {
        blockchainKey: request.blockchainKey,
        error: errorMessage,
      });

      return {
        success: false,
        balance: '0',
        error: errorMessage,
      };
    }
  }

  protected async checkBalance(walletAddress: string): Promise<string> {
    try {
      // Use Blockstream.info API to check balance
      const response = await fetch(`https://blockstream.info/api/address/${walletAddress}`);

      if (!response.ok) {
        this.logger.error(`Failed to check balance for ${walletAddress}`, {
          status: response.status,
          statusText: response.statusText,
        });
        return '0';
      }

      const data = (await response.json()) as {
        chain_stats: { funded_txo_sum: number; spent_txo_sum: number };
        mempool_stats: { funded_txo_sum: number; spent_txo_sum: number };
      };

      // Calculate balance: (funded - spent) from both confirmed and mempool
      const confirmedBalance = data.chain_stats.funded_txo_sum - data.chain_stats.spent_txo_sum;
      const mempoolBalance = data.mempool_stats.funded_txo_sum - data.mempool_stats.spent_txo_sum;
      const totalBalance = confirmedBalance + mempoolBalance;

      return totalBalance.toString();
    } catch (error) {
      this.logger.error(`Failed to check balance for ${walletAddress}`, { error });
      return '0';
    }
  }

  protected async transferToHotWallet(
    invoiceWalletDerivationPath: string,
    hotWalletAddress: string,
    balance: string,
  ): Promise<{ txHash: string; transferredAmount: string }> {
    const balanceBigInt = BigInt(balance);
    // Keep minimum balance for transaction fees
    const transferAmountSatoshis = balanceBigInt - this.MIN_BALANCE_SATOSHIS;
    const transferAmountBtc = Number(transferAmountSatoshis) / 100000000;

    // Get invoice wallet
    const masterKey = await this.platformWalletService.getMasterKey();
    const walletService = this.walletFactory.getWalletService(BlockchainNetworkEnum.BitcoinMainnet);
    const invoiceWallet = await walletService.derivedPathToWallet({
      masterKey,
      derivationPath: invoiceWalletDerivationPath,
    });

    // Transfer
    const result = await invoiceWallet.transfer({
      to: hotWalletAddress,
      value: transferAmountBtc.toString(),
      tokenId: 'native',
      from: await invoiceWallet.getAddress(),
    });

    return {
      txHash: result.txHash,
      transferredAmount: transferAmountSatoshis.toString(),
    };
  }
}
