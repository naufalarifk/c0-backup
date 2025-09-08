import { Injectable, Logger } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  TransactionResponse,
} from '@solana/web3.js';

import { FeatureFlag } from './feature-flag.decorator';
import { SolanaSignatureResponseDto } from './hdwalletdto';

interface SolanaTransactionParams {
  to: string;
  amount: number;
  memo?: string;
}

export interface SolanaWalletConfig {
  network: 'mainnet' | 'testnet' | 'devnet';
  rpcEndpoint: string;
}

@Injectable()
@FeatureFlag('sol')
export class SolWalletService {
  private readonly logger = new Logger(SolWalletService.name);
  private connection: Connection;

  constructor(private readonly config: SolanaWalletConfig) {
    this.connection = new Connection(this.config.rpcEndpoint, 'confirmed');
  }

  /**
   * Generate Solana address and keys from HD path
   */
  generateWallet(
    masterKey: HDKey,
    accountIndex: number = 0,
    addressIndex: number = 0,
  ): {
    address: string;
    publicKey: string;
    privateKey: string;
    derivationPath: string;
  } {
    const derivationPath = `m/44'/501'/${accountIndex}'/${addressIndex}'`;
    const child = masterKey.derive(derivationPath);

    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }

    // Create Solana keypair from the derived private key (first 32 bytes)
    const privateKeySeed = child.privateKey.slice(0, 32);
    const keypair = Keypair.fromSeed(privateKeySeed);

    return {
      address: keypair.publicKey.toBase58(),
      publicKey: keypair.publicKey.toBase58(),
      privateKey: Buffer.from(keypair.secretKey).toString('hex'),
      derivationPath,
    };
  }

  /**
   * Get Solana balance for an address
   */
  async getBalance(address: string): Promise<number> {
    try {
      const publicKey = new PublicKey(address);
      const balance = await this.connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } catch (error) {
      this.logger.error('Failed to get Solana balance:', error);
      throw new Error('Failed to fetch Solana balance');
    }
  }

  /**
   * Get latest blockhash
   */
  async getLatestBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    try {
      return await this.connection.getLatestBlockhash();
    } catch (error) {
      this.logger.error('Failed to get latest blockhash:', error);
      throw new Error('Failed to get latest blockhash');
    }
  }

  /**
   * Sign Solana transaction
   */
  async signSolanaTransaction(
    privateKeyHex: string,
    params: SolanaTransactionParams,
  ): Promise<SolanaSignatureResponseDto> {
    try {
      // Create keypair from private key
      const secretKey = Buffer.from(privateKeyHex, 'hex');
      const fromKeypair = Keypair.fromSecretKey(secretKey);

      const toPublicKey = new PublicKey(params.to);
      const lamports = params.amount * LAMPORTS_PER_SOL;

      // Create transaction
      const transaction = new Transaction();

      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: fromKeypair.publicKey,
          toPubkey: toPublicKey,
          lamports,
        }),
      );

      // Get latest blockhash
      const { blockhash } = await this.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromKeypair.publicKey;

      // Sign transaction
      transaction.sign(fromKeypair);

      // Get transaction signature
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [fromKeypair],
        { commitment: 'confirmed' },
      );

      return {
        signature,
        recentBlockhash: blockhash,
        transactionFee: 5000, // Standard Solana transaction fee in lamports
        signedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to sign Solana transaction:', error);
      throw new Error('Failed to sign Solana transaction');
    }
  }

  /**
   * Send raw transaction
   */
  async sendRawTransaction(signedTransactionBuffer: Buffer): Promise<string> {
    try {
      const signature = await this.connection.sendRawTransaction(signedTransactionBuffer, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      return signature;
    } catch (error) {
      this.logger.error('Failed to send Solana transaction:', error);
      throw new Error('Failed to send Solana transaction');
    }
  }

  /**
   * Get transaction details
   */
  async getTransaction(signature: string): Promise<TransactionResponse | null> {
    try {
      return await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
      });
    } catch (error) {
      this.logger.error('Failed to get Solana transaction:', error);
      throw new Error('Failed to get transaction details');
    }
  }

  /**
   * Confirm transaction
   */
  async confirmTransaction(
    signature: string,
    commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
  ): Promise<boolean> {
    try {
      const result = await this.connection.confirmTransaction(signature, commitment);
      return result.value.err === null;
    } catch (error) {
      this.logger.error('Failed to confirm Solana transaction:', error);
      return false;
    }
  }

  /**
   * Get account info
   */
  async getAccountInfo(address: string): Promise<{
    lamports: number;
    owner: string;
    executable: boolean;
  } | null> {
    try {
      const publicKey = new PublicKey(address);
      const accountInfo = await this.connection.getAccountInfo(publicKey);

      if (!accountInfo) {
        return null;
      }

      return {
        lamports: accountInfo.lamports,
        owner: accountInfo.owner.toBase58(),
        executable: accountInfo.executable,
      };
    } catch (error) {
      this.logger.error('Failed to get account info:', error);
      throw new Error('Failed to get account info');
    }
  }
}
