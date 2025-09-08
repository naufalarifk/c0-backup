import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from '@solana/web3.js';

import { IWallet, SolanaTransactionParams } from './Iwallet.types';

export interface SolanaTransactionData {
  params: SolanaTransactionParams;
}

export abstract class BaseSolanaWallet implements IWallet {
  protected abstract connection: Connection;

  constructor(protected readonly privateKey: Uint8Array<ArrayBufferLike>) {}

  getAddress(): Promise<string> {
    return new Promise(resolve => {
      const privateKeyArray = Array.from(this.privateKey);
      const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
      resolve(keypair.publicKey.toBase58());
    });
  }

  signTransaction<T>(transactionData: T): Promise<T> {
    return new Promise((resolve, reject) => {
      void (async () => {
        try {
          if (!this.isSolanaTransactionData(transactionData)) {
            throw new Error('Invalid transaction data format');
          }

          const privateKeyArray = Array.from(this.privateKey);
          const keypair = Keypair.fromSecretKey(Uint8Array.from(privateKeyArray));
          const { params } = transactionData;
          const toPubkey = new PublicKey(params.to);

          const transaction = new Transaction().add(
            SystemProgram.transfer({
              fromPubkey: keypair.publicKey,
              toPubkey,
              lamports: params.amount * LAMPORTS_PER_SOL,
            }),
          );

          transaction.feePayer = keypair.publicKey;
          const { blockhash } = await this.connection.getLatestBlockhash();
          transaction.recentBlockhash = blockhash;
          transaction.sign(keypair);

          const serializedTransaction = transaction.serialize();

          const result = {
            ...transactionData,
            signedTransaction: Buffer.from(serializedTransaction).toString('base64'),
          } as T;

          resolve(result);
        } catch (error) {
          reject(
            new Error(
              `Failed to sign transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ),
          );
        }
      })();
    });
  }

  protected isSolanaTransactionData(data: unknown): data is SolanaTransactionData {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    if (!obj.params || typeof obj.params !== 'object') return false;

    const params = obj.params as Record<string, unknown>;

    return typeof params.to === 'string' && typeof params.amount === 'number';
  }
}
