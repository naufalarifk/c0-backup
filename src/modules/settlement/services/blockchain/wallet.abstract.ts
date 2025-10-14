/**
 * Abstract Base Class for Settlement Blockchain Services
 *
 * This abstract class defines the interface that all blockchain-specific settlement services
 * must implement (e.g., SolService, EthService, BtcService, BnbService).
 *
 * Each blockchain service should extend this class and provide implementations for:
 * 1. Balance queries
 * 2. Transaction status checking
 * 3. Transaction verification
 * 4. Network configuration
 *
 * Pattern:
 * - Abstract methods MUST be implemented by subclasses
 * - Each blockchain has unique transaction formats, so methods return generic types
 * - Subclasses can add blockchain-specific methods beyond this interface
 *
 * @example
 * ```typescript
 * @Injectable()
 * export class SolService extends SettlementBlockchainService {
 *   async getBalance(): Promise<number> {
 *     // Solana-specific implementation
 *   }
 *   // ... other methods
 * }
 * ```
 */
export abstract class SettlementBlockchainService {
  /**
   * Get the blockchain key (CAIP-2 format)
   * Examples: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', 'eip155:1', 'bip122:000000000019d6689c085ae165831e93'
   */
  abstract getBlockchainKey(): string;

  /**
   * Get the current network name
   * Examples: 'mainnet', 'testnet', 'devnet'
   */
  abstract getNetworkName(): string;

  /**
   * Get the RPC URL being used for blockchain queries
   */
  abstract getRpcUrl(): string;

  /**
   * Get hot wallet balance in the blockchain's native unit
   * @returns Balance in smallest unit (lamports for SOL, wei for ETH, satoshis for BTC)
   */
  abstract getBalance(): Promise<number>;

  /**
   * Get balance for a specific address
   * @param address - Blockchain address to check
   * @returns Balance in smallest unit
   */
  abstract getAddressBalance(address: string): Promise<number>;

  /**
   * Get transaction status by signature/hash
   * @param signature - Transaction signature or hash
   * @returns Transaction confirmation status and details
   */
  abstract getTransactionStatus(signature: string): Promise<{
    confirmed: boolean;
    success: boolean;
    slot?: number;
    blockNumber?: number;
    blockTime?: number;
    confirmations?: number | null;
    err?: any;
  }>;

  /**
   * Get detailed transaction information
   * @param signature - Transaction signature or hash
   * @returns Full transaction details including accounts, amounts, and fees
   */
  abstract getTransactionDetails(signature: string): Promise<{
    success: boolean;
    blockTime?: number;
    slot?: number;
    blockNumber?: number;
    fee?: number;
    preBalances?: number[];
    postBalances?: number[];
    accountKeys?: string[];
    err?: any;
    meta?: any;
  }>;

  /**
   * Get comprehensive transaction information for settlement matching
   * This is a higher-level method that provides all details needed for
   * cross-platform transaction matching (e.g., Binance vs blockchain).
   *
   * @param signature - Transaction signature or hash
   * @returns Comprehensive transaction info including confirmation, amounts, addresses
   */
  abstract getTransactionForMatching(signature: string): Promise<{
    found: boolean;
    confirmed: boolean;
    success: boolean;
    amount?: string;
    from?: string;
    to?: string;
    fee?: string;
    blockTime?: number;
    slot?: number;
    blockNumber?: number;
    confirmations?: number;
    raw?: any;
  }>;

  /**
   * Wait for transaction confirmation with timeout
   * @param signature - Transaction signature to wait for
   * @param commitment - Confirmation level (blockchain-specific)
   * @param timeoutSeconds - Maximum time to wait
   * @returns Confirmation status
   */
  abstract waitForConfirmation(
    signature: string,
    commitment?: string,
    timeoutSeconds?: number,
  ): Promise<{
    confirmed: boolean;
    success: boolean;
    slot?: number;
    blockNumber?: number;
    err?: any;
  }>;

  /**
   * Verify that a transfer was successful between two addresses
   * @param signature - Transaction signature
   * @param expectedFrom - Expected sender address
   * @param expectedTo - Expected recipient address
   * @param expectedAmount - Expected amount in smallest unit
   * @returns Verification result with details
   */
  abstract verifyTransfer(
    signature: string,
    expectedFrom: string,
    expectedTo: string,
    expectedAmount: number,
  ): Promise<{
    verified: boolean;
    success: boolean;
    actualAmount?: number;
    fee?: number;
    from?: string;
    to?: string;
    errors?: string[];
  }>;

  /**
   * Check if an address received funds in a specific transaction
   * @param signature - Transaction signature
   * @param address - Address to check
   * @returns Amount received (negative if sent) and transaction details
   */
  abstract getAddressBalanceChange(
    signature: string,
    address: string,
  ): Promise<{
    balanceChange: number;
    success: boolean;
    found: boolean;
  }>;
}

/**
 * Abstract Base Class for Hot Wallet Operations
 *
 * This abstract class defines the interface for hot wallet operations within the settlement system.
 * It focuses on wallet-level operations (balance, transfer, address management) that are common
 * across all blockchains.
 *
 * Difference from SettlementBlockchainService:
 * - HotWalletAbstract: Wallet instance methods (balance, transfer, signing)
 * - SettlementBlockchainService: Blockchain service methods (network config, transaction verification)
 *
 * Pattern:
 * - Hot wallet services implement this for actual wallet operations
 * - Blockchain services (SolService, EthService) coordinate hot wallets
 *
 * @example
 * ```typescript
 * export class SolanaHotWallet extends HotWalletAbstract {
 *   async getBalance(): Promise<string> {
 *     return await this.connection.getBalance(this.address);
 *   }
 *
 *   async transfer(toAddress: string, amount: string): Promise<string> {
 *     const tx = await this.wallet.transfer({ to: toAddress, value: amount });
 *     return tx.signature;
 *   }
 * }
 * ```
 */
export abstract class HotWalletAbstract {
  /**
   * Get the hot wallet's address
   * @returns Blockchain address (base58 for Solana, 0x-prefixed for Ethereum, etc.)
   */
  abstract getAddress(): Promise<string>;

  /**
   * Get hot wallet balance in the blockchain's native currency
   * @returns Balance as string (to handle large numbers and decimals accurately)
   */
  abstract getBalance(): Promise<string>;

  /**
   * Get balance in human-readable format (e.g., SOL instead of lamports, ETH instead of wei)
   * @returns Balance with decimal places as string
   */
  abstract getBalanceFormatted(): Promise<string>;

  /**
   * Transfer funds from hot wallet to another address
   * @param toAddress - Recipient's blockchain address
   * @param amount - Amount to transfer (in smallest unit: lamports, wei, satoshis)
   * @param options - Blockchain-specific options (priority fee, memo, etc.)
   * @returns Transaction signature/hash
   */
  abstract transfer(toAddress: string, amount: string, options?: any): Promise<string>;

  /**
   * Get the blockchain key (CAIP-2 format) this hot wallet belongs to
   * @returns Blockchain identifier (e.g., 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
   */
  abstract getBlockchainKey(): string;

  /**
   * Validate if an address is valid for this blockchain
   * @param address - Address to validate
   * @returns True if valid, false otherwise
   */
  abstract isValidAddress(address: string): boolean;

  /**
   * Get transaction fee estimate for a transfer
   * @param toAddress - Destination address
   * @param amount - Amount to transfer
   * @returns Estimated fee in smallest unit
   */
  abstract estimateFee(toAddress: string, amount: string): Promise<string>;

  /**
   * Sign a message with the hot wallet's private key
   * @param message - Message to sign (string or bytes)
   * @returns Signature as hex string or base58 (blockchain-specific)
   */
  abstract signMessage(message: string | Uint8Array): Promise<string>;

  /**
   * Check if hot wallet has sufficient balance for a transfer (including fees)
   * @param amount - Amount to transfer
   * @param estimatedFee - Optional estimated fee (will calculate if not provided)
   * @returns True if sufficient balance, false otherwise
   */
  abstract hasSufficientBalance(amount: string, estimatedFee?: string): Promise<boolean>;
}
