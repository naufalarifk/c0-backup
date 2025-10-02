import type { BalanceCollectionRequest, BalanceCollectionResult } from './balance-collection.types';

/**
 * Abstract base class for blockchain-specific balance collectors
 * Each blockchain implementation extends this to provide specific collection logic
 */
export abstract class BalanceCollector {
  /**
   * Check if this collector can handle the given request
   */
  abstract canHandle(request: BalanceCollectionRequest): boolean;

  /**
   * Collect balance from invoice wallet and transfer to hot wallet
   */
  abstract collect(request: BalanceCollectionRequest): Promise<BalanceCollectionResult>;

  /**
   * Check balance of a wallet address
   */
  protected abstract checkBalance(walletAddress: string): Promise<string>;

  /**
   * Transfer balance from invoice wallet to hot wallet
   */
  protected abstract transferToHotWallet(
    invoiceWalletDerivationPath: string,
    hotWalletAddress: string,
    balance: string,
  ): Promise<{ txHash: string; transferredAmount: string }>;
}
