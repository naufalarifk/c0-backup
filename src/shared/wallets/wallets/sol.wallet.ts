import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import invariant from 'tiny-invariant';

import { Wallet, WalletTransferParams } from '../wallet.abstract';

export abstract class SolWallet extends Wallet {
  protected abstract connection: Connection;

  constructor(protected readonly privateKey: Uint8Array<ArrayBufferLike>) {
    super();
  }

  async getAddress(): Promise<string> {
    const keypair = this.createKeypair();
    return keypair.publicKey.toBase58();
  }

  async transfer(params: WalletTransferParams): Promise<{ txHash: string }> {
    try {
      const keypair = this.createKeypair();
      const toPubkey = new PublicKey(params.to);
      const amountLamports = Math.floor(parseFloat(params.value) * LAMPORTS_PER_SOL);

      // Build transaction
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey,
          lamports: amountLamports,
        }),
      );

      transaction.feePayer = keypair.publicKey;

      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      // Sign transaction
      transaction.sign(keypair);

      // Send transaction
      const signature = await this.connection.sendRawTransaction(transaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      });

      // Wait for confirmation
      await this.connection.confirmTransaction({
        signature,
        ...(await this.connection.getLatestBlockhash()),
      });

      return { txHash: signature };
    } catch (error) {
      invariant(
        false,
        `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  private createKeypair(): Keypair {
    // Solana expects a 64-byte secret key, but HDKey provides 32 bytes
    // For Solana, we use the 32-byte private key as seed to generate the keypair
    if (this.privateKey.length === 32) {
      return Keypair.fromSeed(new Uint8Array(this.privateKey));
    } else if (this.privateKey.length === 64) {
      return Keypair.fromSecretKey(new Uint8Array(this.privateKey));
    } else {
      throw new Error(
        `Invalid private key length: ${this.privateKey.length}. Expected 32 or 64 bytes.`,
      );
    }
  }
}
