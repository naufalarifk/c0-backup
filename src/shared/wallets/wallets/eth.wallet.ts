import type { TransactionRequest } from 'ethers';

import { ethers } from 'ethers';
import invariant from 'tiny-invariant';

import { Wallet, WalletTransferParams } from '../wallet.abstract';

export class EthWallet extends Wallet {
  constructor(
    protected readonly privateKey: Uint8Array<ArrayBufferLike>,
    protected readonly provider: ethers.JsonRpcProvider,
  ) {
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

  async getBalance(address: string): Promise<number> {
    try {
      const balance = await this.provider.getBalance(address);
      // Convert from wei to ETH
      return parseFloat(ethers.formatEther(balance));
    } catch (error) {
      invariant(
        false,
        `Get balance failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
