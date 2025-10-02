import type {
  BalanceCollectionRequest,
  BalanceCollectionResult,
} from '../balance-collection.types';

import { Injectable } from '@nestjs/common';

import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { WalletFactory } from '../../../shared/wallets/Iwallet.service';
import { PlatformWalletService } from '../../../shared/wallets/platform-wallet.service';
import { BlockchainNetworkEnum } from '../balance-collection.types';
import { BalanceCollector } from '../balance-collector.abstract';
import { CollectorFlag } from '../balance-collector.factory';

/**
 * Solana Balance Collector for Solana Mainnet
 * Handles balance collection and transfers for Solana blockchain
 */
@Injectable()
@CollectorFlag(BlockchainNetworkEnum.SolanaMainnet)
export class SolanaBalanceCollector extends BalanceCollector {
  private readonly logger = new TelemetryLogger(SolanaBalanceCollector.name);

  // Minimum balance to keep for rent exemption + transaction fees (0.001 SOL)
  private readonly MIN_BALANCE_LAMPORTS = BigInt(1000000); // 0.001 SOL in lamports

  private _connection?: Connection;
  protected get connection(): Connection {
    if (!this._connection) {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      this._connection = new Connection(rpcUrl);
    }
    return this._connection;
  }

  constructor(
    private readonly platformWalletService: PlatformWalletService,
    private readonly walletFactory: WalletFactory,
  ) {
    super();
  }

  canHandle(request: BalanceCollectionRequest): boolean {
    return request.blockchainKey === BlockchainNetworkEnum.SolanaMainnet;
  }

  async collect(request: BalanceCollectionRequest): Promise<BalanceCollectionResult> {
    try {
      this.logger.log(`Starting Solana balance collection`, {
        blockchainKey: request.blockchainKey,
        walletAddress: request.walletAddress,
      });

      // Check balance
      const balance = await this.checkBalance(request.walletAddress);
      const balanceBigInt = BigInt(balance);
      const balanceSol = Number(balanceBigInt) / LAMPORTS_PER_SOL;

      this.logger.log(`Balance check: ${balanceSol} SOL`, {
        balance,
        balanceSol,
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
      if (balanceBigInt <= this.MIN_BALANCE_LAMPORTS) {
        return {
          success: true,
          balance,
          skipped: true,
          skipReason: `Balance too small (minimum: ${Number(this.MIN_BALANCE_LAMPORTS) / LAMPORTS_PER_SOL} SOL for fees)`,
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

      const transferredSol = Number(BigInt(transferResult.transferredAmount)) / LAMPORTS_PER_SOL;

      this.logger.log(`Successfully collected ${transferredSol} SOL`, {
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
      this.logger.error(`Failed to collect Solana balance: ${errorMessage}`, {
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
      const publicKey = new (await import('@solana/web3.js')).PublicKey(walletAddress);
      const balance = await this.connection.getBalance(publicKey);
      return balance.toString();
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
    // Keep minimum balance for rent + fees
    const transferAmountLamports = balanceBigInt - this.MIN_BALANCE_LAMPORTS;
    const transferAmountSol = Number(transferAmountLamports) / LAMPORTS_PER_SOL;

    // Get invoice wallet
    const masterKey = await this.platformWalletService.getMasterKey();
    const walletService = this.walletFactory.getWalletService(BlockchainNetworkEnum.SolanaMainnet);
    const invoiceWallet = await walletService.derivedPathToWallet({
      masterKey,
      derivationPath: invoiceWalletDerivationPath,
    });

    // Transfer
    const result = await invoiceWallet.transfer({
      to: hotWalletAddress,
      value: transferAmountSol.toString(),
      tokenId: 'native',
      from: await invoiceWallet.getAddress(),
    });

    return {
      txHash: result.txHash,
      transferredAmount: transferAmountLamports.toString(),
    };
  }
}
