import { Injectable, OnModuleInit } from '@nestjs/common';

import {
  AccountInfo,
  ConfirmedSignatureInfo,
  Connection,
  ParsedTransactionWithMeta,
  PublicKey,
  SignatureResult,
  VersionedTransactionResponse,
} from '@solana/web3.js';
import { Observable } from 'rxjs';

interface SolanaSlotInfo {
  slot: number;
  timestamp?: number;
  transactions?: SolanaTransaction[];
  method?: string;
  blockTime?: number | null;
  blockhash?: string;
}

interface SolanaBlockData {
  transactions?: unknown[];
  blockTime?: number | null;
  blockhash?: string;
}

interface SolanaTransaction {
  signature: string;
  slot?: number;
  blockTime?: number;
  transaction: {
    message: {
      accountKeys: PublicKey[];
      instructions: SolanaInstruction[];
    };
  };
}

interface SolanaInstruction {
  programId: PublicKey;
  accounts: number[];
  data: string;
}

interface SolanaTransactionAnalysis {
  type: string;
  tokens: SolanaTokenTransfer[];
  accounts: string[];
  instructions: SolanaInstructionAnalysis[];
}

interface SolanaTokenTransfer {
  mint: string;
  amount: string;
  decimals: number;
  from?: string;
  to?: string;
}

interface SolanaInstructionAnalysis {
  type: string;
  data?: unknown;
  accounts?: PublicKey[];
}

interface SolanaSignatureStatusInfo {
  signature: string;
  result: SignatureResult;
  context: { slot: number };
  slot: number;
}

interface SolanaTokenMintInfo {
  symbol: string;
  decimals: number;
  name: string;
  mint: string;
}

interface SolanaAccountChangeInfo {
  accountInfo: AccountInfo<Buffer>;
  context: { slot: number };
  slot: number;
  publicKey: string;
}

interface SolanaProgramAccountChangeInfo {
  accountInfo: AccountInfo<Buffer>;
  publicKey: string;
  context: { slot: number };
  account: AccountInfo<Buffer>;
  pubkey: string;
  slot: number;
  programId: string;
}

@Injectable()
export class SolanaService implements OnModuleInit {
  connection: Connection;

  // Common Solana program IDs
  private readonly TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA';
  private readonly TOKEN_2022_PROGRAM_ID = 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb';

  constructor() {
    this.connection = new Connection(
      process.env.SOL_RPC_URL || 'https://api.mainnet-beta.solana.com',
      {
        commitment: 'confirmed',
        wsEndpoint: undefined, // Disable WebSocket subscriptions
      },
    );
  }

  onModuleInit() {
    console.log('Solana service initialized');

    // Test connection on startup
    this.isHealthy()
      .then(healthy => {
        if (healthy) {
          console.log('Solana connection is healthy');
          return this.getCurrentSlot();
        } else {
          console.error('Solana connection is not healthy');
          return null;
        }
      })
      .then(slot => {
        if (slot) {
          console.log(`Current Solana slot: ${slot}`);
        }
      })
      .catch(err => {
        console.error('Error testing Solana connection:', err);
      });
  }

  /**
   * Returns an Observable that emits every new block (slot)
   * Using polling approach since some RPC providers don't support slot subscriptions
   */
  onNewSlot(): Observable<SolanaSlotInfo> {
    return new Observable(subscriber => {
      let lastSlot = 0;
      let isPolling = false;

      const pollForNewSlots = async () => {
        if (isPolling) return;
        isPolling = true;

        try {
          const currentSlot = await this.connection.getSlot();

          if (currentSlot > lastSlot) {
            const slotsToProcess = Math.min(currentSlot - lastSlot, 2); // Process max 2 slots at once to reduce API calls

            for (let slot = lastSlot + 1; slot <= lastSlot + slotsToProcess; slot++) {
              // Add delay between slot processing to avoid rate limits
              await new Promise(resolve => setTimeout(resolve, 100));

              // Fetch block data with transactions
              try {
                const blockData = (await this.getBlock(slot)) as SolanaBlockData;
                if (blockData && blockData.transactions && blockData.transactions.length > 0) {
                  subscriber.next({
                    slot: slot,
                    timestamp: Date.now(),
                    method: 'polling',
                    transactions: (blockData.transactions || []) as SolanaTransaction[],
                    blockTime: blockData.blockTime,
                    blockhash: blockData.blockhash,
                  });
                } else {
                  // If no block data or no transactions, emit just slot info
                  subscriber.next({
                    slot: slot,
                    timestamp: Date.now(),
                    method: 'polling',
                    transactions: [],
                  });
                }
              } catch (error) {
                // Log error if it's not just an empty slot
                console.error(`Error fetching block at slot ${slot}:`, error);
                // If error fetching block, emit just slot info
                subscriber.next({
                  slot: slot,
                  timestamp: Date.now(),
                  method: 'polling',
                  transactions: [],
                });
              }
            }

            lastSlot = lastSlot + slotsToProcess;
            console.log(`SOL processed slots up to ${lastSlot} (current: ${currentSlot})`);
          }
        } catch (error) {
          console.error('Error polling for slots:', error);
        } finally {
          isPolling = false;
        }
      };

      // Initialize with current slot
      this.getCurrentSlot()
        .then(slot => {
          lastSlot = slot;
          console.log(`Starting Solana polling from slot ${slot}`);
        })
        .catch(err => {
          console.error('Error getting initial slot:', err);
        });

      // Poll every 2 seconds
      const pollInterval = setInterval(() => {
        pollForNewSlots().catch(err => {
          console.error('Polling error:', err);
        });
      }, 2000);

      // Cleanup on unsubscribe - only polling, no subscriptions
      return () => {
        clearInterval(pollInterval);
      };
    });
  } /**
   * Returns an Observable that emits account changes for a specific account
   */
  onAccountChange(accountPubkey: string): Observable<SolanaAccountChangeInfo> {
    return new Observable(subscriber => {
      const publicKey = new PublicKey(accountPubkey);

      const handler = (accountInfo: AccountInfo<Buffer> | null, context: { slot: number }) => {
        if (accountInfo) {
          subscriber.next({
            accountInfo,
            context,
            slot: context.slot,
            publicKey: accountPubkey,
          });
        }
      };

      // Subscribe to account changes
      const subscriptionId = this.connection.onAccountChange(publicKey, handler, 'confirmed');

      // Cleanup on unsubscribe
      return () => {
        this.connection.removeAccountChangeListener(subscriptionId).catch(err => {
          console.error('Error removing account change listener', err);
        });
      };
    });
  }

  /**
   * Returns an Observable that emits program account changes
   */
  onProgramAccountChange(programId: string): Observable<SolanaProgramAccountChangeInfo> {
    return new Observable(subscriber => {
      const programPublicKey = new PublicKey(programId);

      const handler = (
        keyedAccountInfo: { accountInfo: AccountInfo<Buffer>; accountId: PublicKey },
        context: { slot: number },
      ) => {
        subscriber.next({
          accountInfo: keyedAccountInfo.accountInfo,
          publicKey: keyedAccountInfo.accountId.toString(),
          account: keyedAccountInfo.accountInfo,
          pubkey: keyedAccountInfo.accountId.toString(),
          context,
          slot: context.slot,
          programId,
        });
      };

      // Subscribe to program account changes
      const subscriptionId = this.connection.onProgramAccountChange(
        programPublicKey,
        handler,
        'confirmed',
      );

      // Cleanup on unsubscribe
      return () => {
        this.connection.removeProgramAccountChangeListener(subscriptionId).catch(err => {
          console.error('Error removing program account change listener', err);
        });
      };
    });
  }

  /**
   * Returns an Observable that emits signature status changes
   */
  onSignatureStatus(signature: string): Observable<SolanaSignatureStatusInfo> {
    return new Observable(subscriber => {
      const handler = (signatureResult: SignatureResult, context: { slot: number }) => {
        subscriber.next({
          signature,
          result: signatureResult,
          context,
          slot: context.slot,
        });
      };

      // Subscribe to signature status changes
      const subscriptionId = this.connection.onSignature(signature, handler, 'confirmed');

      // Cleanup on unsubscribe
      return () => {
        this.connection.removeSignatureListener(subscriptionId).catch(err => {
          console.error('Error removing signature listener', err);
        });
      };
    });
  }

  /**
   * Get block by slot number
   */
  async getBlock(slot: number): Promise<unknown> {
    try {
      const block = await this.connection.getBlock(slot, {
        maxSupportedTransactionVersion: 0,
        commitment: 'confirmed',
      });
      return block;
    } catch (error) {
      // Many slots are empty in Solana, so don't log errors for null blocks
      if (error.message?.includes('not found') || error.message?.includes('null')) {
        return null;
      }
      console.error(`Error fetching block at slot ${slot}:`, error);
      return null;
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo(publicKey: string): Promise<AccountInfo<Buffer> | null> {
    try {
      const pubKey = new PublicKey(publicKey);
      const accountInfo = await this.connection.getAccountInfo(pubKey);
      return accountInfo;
    } catch (error) {
      console.error(`Error fetching account info for ${publicKey}:`, error);
      throw error;
    }
  }

  /**
   * Get transaction details
   */
  // biome-ignore lint/suspicious/noExplicitAny: Solana SDK returns complex versioned transaction structure that varies by version
  async getTransaction(signature: string): Promise<any> {
    try {
      const transaction = await this.connection.getTransaction(signature, {
        maxSupportedTransactionVersion: 0,
      });
      return transaction;
    } catch (error) {
      console.error(`Error fetching transaction ${signature}:`, error);
      throw error;
    }
  }

  /**
   * Get current slot
   */
  async getCurrentSlot(): Promise<number> {
    try {
      const slot = await this.connection.getSlot();
      return slot;
    } catch (error) {
      console.error('Error fetching current slot:', error);
      throw error;
    }
  }

  /**
   * Check connection health
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.connection.getSlot();
      return true;
    } catch (error) {
      console.error('Solana connection health check failed:', error);
      return false;
    }
  }

  /**
   * Analyze a transaction for SPL tokens
   */
  async analyzeTransactionForTokens(signature: string): Promise<SolanaTransactionAnalysis> {
    try {
      const transaction = await this.getTransaction(signature);
      if (!transaction) {
        return { type: 'unknown', tokens: [], accounts: [], instructions: [] };
      }

      const analysis: SolanaTransactionAnalysis = {
        type: 'native', // SOL transfer by default
        tokens: [],
        accounts:
          transaction.transaction?.message?.accountKeys?.map((key: PublicKey) => key.toString()) ||
          [],
        instructions: [],
      };

      // Check if transaction structure is valid
      if (!transaction.transaction?.message?.instructions) {
        return { type: 'native', tokens: [], accounts: [], instructions: [] };
      }

      // Analyze instructions for token operations
      for (const instruction of transaction.transaction.message.instructions) {
        const programId =
          transaction.transaction.message.accountKeys[instruction.programIdIndex].toString();

        if (programId === this.TOKEN_PROGRAM_ID || programId === this.TOKEN_2022_PROGRAM_ID) {
          analysis.type = 'spl-token';

          // Decode instruction data for token operations
          const instructionData = this.decodeTokenInstruction(instruction);
          if (instructionData) {
            analysis.instructions.push(instructionData);

            // Get token account info
            for (const accountIndex of instruction.accounts) {
              const accountKey =
                transaction.transaction.message.accountKeys[accountIndex].toString();
              const tokenAccountInfo = await this.getTokenAccountInfo(accountKey);
              if (tokenAccountInfo) {
                analysis.tokens.push(tokenAccountInfo);
              }
            }
          }
        }
      }

      // Remove duplicates
      analysis.tokens = analysis.tokens.filter(
        (token, index, self) => index === self.findIndex(t => t.mint === token.mint),
      );

      return analysis;
    } catch (error) {
      console.error('Error analyzing Solana transaction for tokens:', error);
      return { type: 'error', tokens: [], accounts: [], instructions: [] };
    }
  }

  /**
   * Get SPL token account information
   */
  // biome-ignore lint/suspicious/noExplicitAny: Token account parsing returns flexible structure for compatibility
  async getTokenAccountInfo(accountAddress: string): Promise<any> {
    try {
      const publicKey = new PublicKey(accountAddress);
      const accountInfo = await this.connection.getAccountInfo(publicKey);

      if (!accountInfo || accountInfo.data.length < 64) {
        return null;
      }

      // Parse token account data (simplified)
      const mint = new PublicKey(accountInfo.data.slice(0, 32));
      const owner = new PublicKey(accountInfo.data.slice(32, 64));

      // Get mint information for token details
      const tokenInfo = await this.getTokenMintInfo(mint.toString());

      return {
        account: accountAddress,
        owner: owner.toString(),
        ...tokenInfo,
      };
    } catch {
      return null;
    }
  }

  /**
   * Get SPL token mint information
   */
  async getTokenMintInfo(mintAddress: string): Promise<SolanaTokenMintInfo> {
    try {
      const mintPublicKey = new PublicKey(mintAddress);
      const mintInfo = await this.connection.getAccountInfo(mintPublicKey);

      if (!mintInfo) {
        return { symbol: 'UNKNOWN', decimals: 0, name: 'Unknown Token', mint: mintAddress };
      }

      // Parse mint data (simplified - real parsing would need proper deserialization)
      const decimals = mintInfo.data[44]; // Decimals are at byte 44 in mint account

      return {
        symbol: 'SPL', // Would need to fetch from metadata
        decimals: decimals,
        name: 'SPL Token',
        mint: mintAddress,
      };
    } catch {
      return { symbol: 'UNKNOWN', decimals: 0, name: 'Unknown Token', mint: mintAddress };
    }
  }

  /**
   * Decode token instruction (simplified)
   */
  private decodeTokenInstruction(instruction: {
    programId: PublicKey;
    data: Buffer;
    accounts: PublicKey[];
  }): { type: string; data?: unknown; accounts?: PublicKey[] } | null {
    if (!instruction.data || instruction.data.length === 0) {
      return null;
    }

    // First byte indicates instruction type
    const instructionType = instruction.data[0];

    const instructionTypes = {
      3: 'Transfer',
      7: 'MintTo',
      8: 'Burn',
      9: 'CloseAccount',
      12: 'TransferChecked',
    };

    return {
      type: instructionTypes[instructionType] || 'Unknown',
      accounts: instruction.accounts,
      data: instruction.data,
    };
  }
}
