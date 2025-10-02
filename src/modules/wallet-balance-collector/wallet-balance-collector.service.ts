import { Injectable } from '@nestjs/common';

import { ethers } from 'ethers';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { WalletFactory } from '../../shared/wallets/Iwallet.service';
import { IWallet } from '../../shared/wallets/Iwallet.types';
import { PlatformWalletService } from '../../shared/wallets/platform-wallet.service';

interface CollectBalanceParams {
  invoiceId: string;
  blockchainKey: string;
  walletAddress: string;
  walletDerivationPath: string;
}

interface CollectBalanceResult {
  success: boolean;
  balance: string;
  transferredAmount?: string;
  transactionHash?: string;
  error?: string;
}

@Injectable()
export class WalletBalanceCollectorService {
  private readonly logger = new TelemetryLogger(WalletBalanceCollectorService.name);

  constructor(
    private readonly platformWalletService: PlatformWalletService,
    private readonly walletFactory: WalletFactory,
  ) {}

  async collectBalance(params: CollectBalanceParams): Promise<CollectBalanceResult> {
    try {
      this.logger.log(
        `Starting balance collection for invoice ${params.invoiceId} on ${params.blockchainKey}`,
        {
          invoiceId: params.invoiceId,
          blockchainKey: params.blockchainKey,
          walletAddress: params.walletAddress,
          walletDerivationPath: params.walletDerivationPath,
        },
      );

      // Get the invoice wallet
      const masterKey = await this.platformWalletService.getMasterKey();
      const walletService = this.walletFactory.getWalletService(params.blockchainKey);
      const invoiceWallet = await walletService.derivedPathToWallet({
        masterKey,
        derivationPath: params.walletDerivationPath,
      });

      // Get the hot wallet (platform's operational wallet)
      const hotWallet = await walletService.getHotWallet(masterKey);
      const hotWalletAddress = await hotWallet.getAddress();

      // Check the balance of the invoice wallet
      const balance = await this.checkBalance(params.blockchainKey, params.walletAddress);

      this.logger.log(
        `Balance check for invoice ${params.invoiceId}: ${balance} (blockchain: ${params.blockchainKey})`,
        {
          invoiceId: params.invoiceId,
          blockchainKey: params.blockchainKey,
          walletAddress: params.walletAddress,
          balance,
        },
      );

      // If balance is zero or very small, skip transfer
      if (balance === '0' || BigInt(balance) <= 0n) {
        this.logger.log(
          `No balance to collect for invoice ${params.invoiceId}. Balance: ${balance}`,
          {
            invoiceId: params.invoiceId,
            blockchainKey: params.blockchainKey,
            balance,
          },
        );
        return { success: true, balance };
      }

      // Transfer the balance to the hot wallet
      this.logger.log(
        `Transferring balance ${balance} from invoice wallet ${params.walletAddress} to hot wallet ${hotWalletAddress}`,
        {
          invoiceId: params.invoiceId,
          blockchainKey: params.blockchainKey,
          from: params.walletAddress,
          to: hotWalletAddress,
          amount: balance,
        },
      );

      const transferResult = await this.transferToHotWallet(
        params.blockchainKey,
        invoiceWallet,
        hotWalletAddress,
        balance,
      );

      this.logger.log(
        `Successfully collected balance for invoice ${params.invoiceId}. Transaction: ${transferResult.txHash}`,
        {
          invoiceId: params.invoiceId,
          blockchainKey: params.blockchainKey,
          transactionHash: transferResult.txHash,
          transferredAmount: balance,
        },
      );

      return {
        success: true,
        balance,
        transferredAmount: balance,
        transactionHash: transferResult.txHash,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to collect balance for invoice ${params.invoiceId}: ${errorMessage}`,
        {
          invoiceId: params.invoiceId,
          blockchainKey: params.blockchainKey,
          error: errorMessage,
        },
      );

      return {
        success: false,
        balance: '0',
        error: errorMessage,
      };
    }
  }

  private async checkBalance(blockchainKey: string, walletAddress: string): Promise<string> {
    // Check balance based on blockchain type
    if (blockchainKey.startsWith('eip155:')) {
      // Ethereum-based chain
      return this.checkEthereumBalance(blockchainKey, walletAddress);
    } else if (blockchainKey.startsWith('solana:')) {
      // Solana chain
      return this.checkSolanaBalance(blockchainKey, walletAddress);
    } else if (blockchainKey.startsWith('bip122:')) {
      // Bitcoin chain
      return this.checkBitcoinBalance(blockchainKey, walletAddress);
    }

    throw new Error(`Unsupported blockchain: ${blockchainKey}`);
  }

  private async checkEthereumBalance(
    blockchainKey: string,
    walletAddress: string,
  ): Promise<string> {
    // Get provider URL based on chain
    const rpcUrl = this.getEthereumRpcUrl(blockchainKey);
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const balance = await provider.getBalance(walletAddress);
    return balance.toString();
  }

  private async checkSolanaBalance(
    _blockchainKey: string,
    _walletAddress: string,
  ): Promise<string> {
    // TODO: Implement Solana balance check
    // For now, return 0
    this.logger.warn('Solana balance check not yet implemented');
    return '0';
  }

  private async checkBitcoinBalance(
    _blockchainKey: string,
    _walletAddress: string,
  ): Promise<string> {
    // TODO: Implement Bitcoin balance check
    // For now, return 0
    this.logger.warn('Bitcoin balance check not yet implemented');
    return '0';
  }

  private async transferToHotWallet(
    blockchainKey: string,
    invoiceWallet: IWallet,
    hotWalletAddress: string,
    balance: string,
  ): Promise<{ txHash: string }> {
    // Transfer based on blockchain type
    if (blockchainKey.startsWith('eip155:')) {
      // Ethereum-based chain
      return this.transferEthereumToHotWallet(invoiceWallet, hotWalletAddress, balance);
    } else if (blockchainKey.startsWith('solana:')) {
      // Solana chain
      throw new Error('Solana transfers not yet implemented');
    } else if (blockchainKey.startsWith('bip122:')) {
      // Bitcoin chain
      throw new Error('Bitcoin transfers not yet implemented');
    }

    throw new Error(`Unsupported blockchain: ${blockchainKey}`);
  }

  private async transferEthereumToHotWallet(
    invoiceWallet: IWallet,
    hotWalletAddress: string,
    balance: string,
  ): Promise<{ txHash: string }> {
    // For Ethereum, we need to reserve some ETH for gas
    const balanceBigInt = BigInt(balance);
    const gasReserve = BigInt(21000) * BigInt(20000000000); // 21000 gas * 20 gwei

    if (balanceBigInt <= gasReserve) {
      throw new Error(
        `Balance ${balance} is too small to cover gas costs (reserve: ${gasReserve})`,
      );
    }

    const transferAmount = (balanceBigInt - gasReserve).toString();
    const transferAmountEth = ethers.formatEther(transferAmount);

    const result = await invoiceWallet.transfer({
      to: hotWalletAddress,
      value: transferAmountEth,
      tokenId: 'native',
      from: await invoiceWallet.getAddress(),
    });

    return { txHash: result.txHash };
  }

  private getEthereumRpcUrl(blockchainKey: string): string {
    switch (blockchainKey) {
      case 'eip155:1': // Ethereum mainnet
        return process.env.ETHEREUM_RPC_URL || 'https://eth.llamarpc.com';
      case 'eip155:56': // BSC
        return process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org';
      case 'eip155:11155111': // Ethereum Sepolia testnet
        return process.env.ETHEREUM_TESTNET_RPC_URL || 'https://ethereum-sepolia.publicnode.com';
      default:
        throw new Error(`Unknown Ethereum chain: ${blockchainKey}`);
    }
  }
}
