import type { TransactionRequest } from 'ethers';

import { ethers } from 'ethers';
import invariant from 'tiny-invariant';

import { IWallet, WalletTransferParams } from './Iwallet.types';

export abstract class BaseEthereumWallet extends IWallet {
  protected abstract provider: ethers.JsonRpcProvider;

  constructor(protected readonly privateKey: Uint8Array<ArrayBufferLike>) {
    super();
  }

  async getAddress(): Promise<string> {
    const privateKeyHex = Buffer.from(this.privateKey).toString('hex');
    const wallet = new ethers.Wallet(privateKeyHex);
    return wallet.address;
  }

  async transfer(params: WalletTransferParams): Promise<{ txHash: string }> {
    try {
      const privateKeyHex = Buffer.from(this.privateKey).toString('hex');
      const wallet = new ethers.Wallet(privateKeyHex, this.provider);

      // Get gas price
      const feeData = await this.provider.getFeeData();

      // Build transaction
      const transaction: TransactionRequest = {
        to: params.to,
        value: ethers.parseEther(params.value),
        gasLimit: BigInt(21000),
        gasPrice: feeData.gasPrice || BigInt(20000000000), // 20 gwei fallback
      };

      // Sign transaction
      const signedTx = await wallet.signTransaction(transaction);

      // Send transaction
      const txResponse = await this.provider.broadcastTransaction(signedTx);

      // Wait for confirmation
      const receipt = await txResponse.wait();

      return { txHash: receipt?.hash || txResponse.hash };
    } catch (error) {
      invariant(
        false,
        `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
