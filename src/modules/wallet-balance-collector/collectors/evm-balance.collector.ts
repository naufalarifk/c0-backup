import type {
  BalanceCollectionRequest,
  BalanceCollectionResult,
  BlockchainNetwork,
} from '../balance-collection.types';

import { Injectable } from '@nestjs/common';

import { ethers } from 'ethers';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { WalletFactory } from '../../../shared/wallets/wallet.factory';
import { BlockchainNetworkEnum, getBlockchainType } from '../balance-collection.types';
import { BalanceCollector } from '../balance-collector.abstract';
import { CollectorFlag } from '../balance-collector.factory';

/**
 * EVM Balance Collector for Ethereum-compatible chains
 * Handles: Ethereum Mainnet, BSC, Ethereum Sepolia
 */
@Injectable()
@CollectorFlag(BlockchainNetworkEnum.EthereumMainnet)
export class EVMBalanceCollector extends BalanceCollector {
  protected readonly logger = new TelemetryLogger(EVMBalanceCollector.name);

  // Gas reserve: 21000 gas * 20 gwei
  protected readonly GAS_RESERVE = BigInt(21000) * BigInt(20000000000);

  constructor(
    readonly appConfig: AppConfigService,
    private readonly walletFactory: WalletFactory,
  ) {
    super();
  }

  canHandle(request: BalanceCollectionRequest): boolean {
    return getBlockchainType(request.blockchainKey) === 'evm';
  }

  async collect(request: BalanceCollectionRequest): Promise<BalanceCollectionResult> {
    try {
      this.logger.log(`Starting EVM balance collection on ${request.blockchainKey}`, {
        blockchainKey: request.blockchainKey,
        walletAddress: request.walletAddress,
      });

      // Check balance
      const balance = await this.checkBalance(request.walletAddress);
      const balanceBigInt = BigInt(balance);

      this.logger.log(`Balance check: ${ethers.formatEther(balance)} ETH`, {
        balance,
        balanceEth: ethers.formatEther(balance),
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

      // Skip if balance is too small to cover gas
      if (balanceBigInt <= this.GAS_RESERVE) {
        return {
          success: true,
          balance,
          skipped: true,
          skipReason: `Balance too small to cover gas (reserve: ${ethers.formatEther(this.GAS_RESERVE)} ETH)`,
        };
      }

      // Get hot wallet address
      const blockchain = this.walletFactory.getBlockchain(request.blockchainKey);
      if (!blockchain) {
        throw new Error(`Unsupported blockchain: ${request.blockchainKey}`);
      }
      const hotWallet = await blockchain.getHotWallet();
      const hotWalletAddress = await hotWallet.getAddress();

      // Transfer balance
      const transferResult = await this.transferToHotWallet(
        request.walletDerivationPath,
        hotWalletAddress,
        balance,
      );

      this.logger.log(
        `Successfully collected ${ethers.formatEther(transferResult.transferredAmount)} ETH`,
        {
          transactionHash: transferResult.txHash,
          transferredAmount: transferResult.transferredAmount,
        },
      );

      return {
        success: true,
        balance,
        transferredAmount: transferResult.transferredAmount,
        transactionHash: transferResult.txHash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to collect EVM balance: ${errorMessage}`, {
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
    const rpcUrl = this.getRpcUrl();
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(walletAddress);
    return balance.toString();
  }

  protected async transferToHotWallet(
    invoiceWalletDerivationPath: string,
    hotWalletAddress: string,
    balance: string,
  ): Promise<{ txHash: string; transferredAmount: string }> {
    const balanceBigInt = BigInt(balance);
    const transferAmount = balanceBigInt - this.GAS_RESERVE;
    const transferAmountEth = ethers.formatEther(transferAmount);

    // Get invoice wallet
    const blockchain = this.walletFactory.getBlockchain(BlockchainNetworkEnum.EthereumMainnet);
    if (!blockchain) {
      throw new Error(`Unsupported blockchain: ${BlockchainNetworkEnum.EthereumMainnet}`);
    }
    const invoiceWallet = await blockchain.derivedPathToWallet(invoiceWalletDerivationPath);

    // Transfer
    const result = await invoiceWallet.transfer({
      to: hotWalletAddress,
      value: transferAmountEth,
      tokenId: 'native',
      from: await invoiceWallet.getAddress(),
    });

    return {
      txHash: result.txHash,
      transferredAmount: transferAmount.toString(),
    };
  }

  protected getRpcUrl(): string {
    return this.appConfig.blockchains[BlockchainNetworkEnum.EthereumMainnet].rpcUrls[0];
  }
}
