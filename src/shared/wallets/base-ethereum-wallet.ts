import { ethers } from 'ethers';
import invariant from 'tiny-invariant';

import { EthereumTransactionParams, IWallet } from './Iwallet.types';

export interface EthereumTransactionData {
  params: EthereumTransactionParams;
}

export abstract class BaseEthereumWallet implements IWallet {
  protected abstract provider: ethers.JsonRpcProvider;

  constructor(protected readonly privateKey: Uint8Array<ArrayBufferLike>) {}

  getAddress(): Promise<string> {
    return new Promise(resolve => {
      const privateKeyHex = Buffer.from(this.privateKey).toString('hex');
      const wallet = new ethers.Wallet(privateKeyHex);
      resolve(wallet.address as `0x${string}`);
    });
  }

  signTransaction<T>(transactionData: T): Promise<T> {
    return new Promise((resolve, reject) => {
      void (async () => {
        try {
          if (!this.isEthereumTransactionData(transactionData)) {
            throw new Error('Invalid transaction data format');
          }

          const privateKeyHex = Buffer.from(this.privateKey).toString('hex');
          const wallet = new ethers.Wallet(privateKeyHex, this.provider);

          const { params } = transactionData;
          const transaction = {
            to: params.to,
            value: ethers.parseEther(params.value),
            gasLimit: params.gasLimit ? BigInt(params.gasLimit) : BigInt(21000),
            gasPrice: params.gasPrice ? ethers.parseUnits(params.gasPrice, 'gwei') : undefined,
            data: params.data || '0x',
          };

          // Get gas price if not provided
          if (!transaction.gasPrice) {
            const feeData = await this.provider.getFeeData();
            transaction.gasPrice = feeData.gasPrice || BigInt(20000000000); // 20 gwei fallback
          }

          const signedTx = await wallet.signTransaction(transaction);

          const result = {
            ...transactionData,
            signedTransaction: signedTx,
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

  protected isEthereumTransactionData(data: unknown): data is EthereumTransactionData {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    if (!obj.params || typeof obj.params !== 'object') return false;

    const params = obj.params as Record<string, unknown>;

    return typeof params.to === 'string' && typeof params.value === 'string';
  }

  async sendTransaction<T>(signedMessage: T): Promise<T> {
    try {
      // Extract the signed transaction from the message
      invariant(
        signedMessage && typeof signedMessage === 'object',
        'Invalid signed message format',
      );

      const messageObj = signedMessage as Record<string, unknown>;
      const signedTransactionHex = messageObj.signedTransaction;

      invariant(
        typeof signedTransactionHex === 'string',
        'Signed transaction not found in message',
      );

      // Send the transaction to the network
      const txResponse = await this.provider.broadcastTransaction(signedTransactionHex);

      // Wait for confirmation
      const receipt = await txResponse.wait();

      // Return the result with transaction hash
      return {
        ...signedMessage,
        transactionHash: receipt?.hash || txResponse.hash,
        success: true,
        blockNumber: receipt?.blockNumber,
        gasUsed: receipt?.gasUsed?.toString(),
      } as T;
    } catch (error) {
      return {
        ...signedMessage,
        transactionHash: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      } as T;
    }
  }
}
