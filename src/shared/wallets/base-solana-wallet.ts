import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';
import invariant from 'tiny-invariant';

import { IWallet, WalletTransferParams } from './Iwallet.types';

export abstract class BaseSolanaWallet extends IWallet {
  protected abstract connection: Connection;

  constructor(protected readonly privateKey: Uint8Array<ArrayBufferLike>) {
    super();
  }

  async getAddress(): Promise<string> {
    const privateKeyArray = Array.from(this.privateKey);
    const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
    return keypair.publicKey.toBase58();
  }

  async transfer(params: WalletTransferParams): Promise<{ txHash: string }> {
    try {
      const privateKeyArray = Array.from(this.privateKey);
      const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
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
}
