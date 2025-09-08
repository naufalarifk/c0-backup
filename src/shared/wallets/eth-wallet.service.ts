import { Injectable, Logger } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { ethers } from 'ethers';

import { FeatureFlag } from './feature-flag.decorator';
import { EthereumSignatureResponseDto } from './hdwalletdto';
import { WalletService } from './wallet.service';

interface EthereumTransactionParams {
  to: string;
  value: string;
  gasLimit?: number;
  gasPrice?: string;
  data?: string;
}

export interface EthereumWalletConfig {
  network: 'mainnet' | 'testnet';
  rpcEndpoint: string;
}

@Injectable()
@FeatureFlag('eth')
export class EthWalletService {
  private readonly logger = new Logger(EthWalletService.name);
  private provider: ethers.JsonRpcProvider;

  constructor(private readonly config: EthereumWalletConfig) {
    this.provider = new ethers.JsonRpcProvider(this.config.rpcEndpoint);
  }

  /**
   * Generate Ethereum address and keys from HD path
   */
  generateWallet(
    masterKey: HDKey,
    accountIndex: number = 0,
    addressIndex: number = 0,
  ): {
    address: `0x${string}`;
    publicKey: string;
    privateKey: string;
    derivationPath: string;
  } {
    const derivationPath = `m/44'/60'/${accountIndex}'/0/${addressIndex}`;
    const child = masterKey.derive(derivationPath);

    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }

    const privateKeyHex = Buffer.from(child.privateKey).toString('hex');
    const wallet = new ethers.Wallet(`0x${privateKeyHex}`);

    return {
      address: wallet.address as `0x${string}`,
      publicKey: wallet.signingKey.publicKey,
      privateKey: privateKeyHex,
      derivationPath,
    };
  }

  /**
   * Get Ethereum balance for an address
   */
  async getBalance(address: string): Promise<string> {
    try {
      const balance = await this.provider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      this.logger.error('Failed to get Ethereum balance:', error);
      throw new Error('Failed to fetch Ethereum balance');
    }
  }

  /**
   * Get gas price estimate
   */
  async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || BigInt(0);
    } catch (error) {
      this.logger.error('Failed to get gas price:', error);
      throw new Error('Failed to get gas price');
    }
  }

  /**
   * Estimate gas for transaction
   */
  async estimateGas(transaction: EthereumTransactionParams): Promise<bigint> {
    try {
      const gasEstimate = await this.provider.estimateGas({
        to: transaction.to,
        value: ethers.parseEther(transaction.value),
        data: transaction.data,
      });
      return gasEstimate;
    } catch (error) {
      this.logger.error('Failed to estimate gas:', error);
      throw new Error('Failed to estimate gas');
    }
  }

  /**
   * Sign Ethereum transaction
   */
  async signTransaction(
    privateKeyHex: string,
    params: EthereumTransactionParams,
  ): Promise<EthereumSignatureResponseDto> {
    try {
      const wallet = new ethers.Wallet(`0x${privateKeyHex}`, this.provider);

      const transaction = {
        to: params.to,
        value: ethers.parseEther(params.value),
        gasLimit: params.gasLimit ? BigInt(params.gasLimit) : await this.estimateGas(params),
        gasPrice: params.gasPrice
          ? ethers.parseUnits(params.gasPrice, 'gwei')
          : await this.getGasPrice(),
        data: params.data || '0x',
      };

      const signedTx = await wallet.signTransaction(transaction);
      const txResponse = await wallet.sendTransaction(transaction);

      return {
        transactionHash: txResponse.hash,
        signedTransaction: signedTx,
        gasUsed: Number(transaction.gasLimit),
        gasPrice: transaction.gasPrice.toString(),
        nonce: await this.getNonce(wallet.address),
        signedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to sign Ethereum transaction:', error);
      throw new Error('Failed to sign Ethereum transaction');
    }
  }

  /**
   * Send raw transaction
   */
  async sendRawTransaction(signedTransactionHex: string): Promise<string> {
    try {
      const txResponse = await this.provider.broadcastTransaction(signedTransactionHex);
      return txResponse.hash;
    } catch (error) {
      this.logger.error('Failed to send Ethereum transaction:', error);
      throw new Error('Failed to send Ethereum transaction');
    }
  }

  /**
   * Get transaction receipt
   */
  async getTransactionReceipt(txHash: string): Promise<ethers.TransactionReceipt | null> {
    try {
      return await this.provider.getTransactionReceipt(txHash);
    } catch (error) {
      this.logger.error('Failed to get transaction receipt:', error);
      throw new Error('Failed to get transaction receipt');
    }
  }

  /**
   * Get current nonce for address
   */
  async getNonce(address: string): Promise<number> {
    try {
      return await this.provider.getTransactionCount(address);
    } catch (error) {
      this.logger.error('Failed to get nonce:', error);
      throw new Error('Failed to get nonce');
    }
  }
}
