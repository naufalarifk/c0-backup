import { Injectable, Logger } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecPair from 'ecpair';
import * as ecc from 'tiny-secp256k1';

import { FeatureFlag } from './feature-flag.decorator';
import { BitcoinSignatureResponseDto } from './hdwalletdto';

interface BitcoinTransactionInput {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: string;
}

interface BitcoinTransactionOutput {
  address: string;
  value: number;
}

export interface BitcoinWalletConfig {
  network: 'mainnet' | 'testnet';
  rpcEndpoint: string;
}

@Injectable()
@FeatureFlag('btc')
export class BtcWalletService {
  private readonly logger = new Logger(BtcWalletService.name);

  constructor(private readonly config: BitcoinWalletConfig) {}

  /**
   * Generate Bitcoin address and keys from HD path
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
    const derivationPath = `m/44'/0'/${accountIndex}'/0/${addressIndex}`;
    const child = masterKey.derive(derivationPath);

    if (!child.privateKey) {
      throw new Error('Failed to derive private key');
    }

    const ECPair = ecPair.ECPairFactory(ecc);
    const keyPair = ECPair.fromPrivateKey(Buffer.from(child.privateKey));

    // Ensure public key is in the correct format for bitcoinjs-lib
    const publicKeyBuffer = Buffer.from(keyPair.publicKey);

    // Generate P2WPKH (native segwit) address
    const { address } = bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
      network:
        this.config.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet,
    });

    if (!address) {
      throw new Error('Failed to generate Bitcoin address');
    }

    return {
      address,
      publicKey: publicKeyBuffer.toString('hex'),
      privateKey: keyPair.privateKey?.toString('hex') || '',
      derivationPath,
    };
  }

  /**
   * Get Bitcoin balance for an address
   */
  async getBalance(address: string): Promise<{
    balance: number;
    confirmed: number;
    unconfirmed: number;
  }> {
    try {
      const response = await fetch(`${this.config.rpcEndpoint}/address/${address}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Parse Blockstream API response format
      const confirmed = data.chain_stats?.funded_txo_sum || 0;
      const spent = data.chain_stats?.spent_txo_sum || 0;
      const unconfirmed = data.mempool_stats?.funded_txo_sum || 0;
      const balance = confirmed - spent + unconfirmed;

      return {
        balance: balance / 100000000, // Convert satoshis to BTC
        confirmed: (confirmed - spent) / 100000000,
        unconfirmed: unconfirmed / 100000000,
      };
    } catch (error) {
      this.logger.error('Failed to get Bitcoin balance:', error);
      throw new Error('Failed to fetch Bitcoin balance');
    }
  }

  /**
   * Sign Bitcoin transaction
   */
  async signTransaction(
    privateKeyHex: string,
    inputs: BitcoinTransactionInput[],
    outputs: BitcoinTransactionOutput[],
  ): Promise<BitcoinSignatureResponseDto> {
    try {
      const network =
        this.config.network === 'mainnet' ? bitcoin.networks.bitcoin : bitcoin.networks.testnet;

      const ECPair = ecPair.ECPairFactory(ecc);
      const keyPair = await ECPair.fromPrivateKey(Buffer.from(privateKeyHex, 'hex'));

      const psbt = new bitcoin.Psbt({ network });

      // Add inputs
      for (const input of inputs) {
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          witnessUtxo: {
            script: Buffer.from(input.scriptPubKey, 'hex'),
            value: input.value,
          },
        });
      }

      // Add outputs
      for (const output of outputs) {
        psbt.addOutput({
          address: output.address,
          value: output.value,
        });
      }

      // Sign all inputs
      for (let i = 0; i < inputs.length; i++) {
        psbt.signInput(i, keyPair);
      }

      // Calculate total inputs and outputs for fee calculation
      const totalInputs = inputs.reduce((sum, input) => sum + input.value, 0);
      const totalOutputs = outputs.reduce((sum, output) => sum + output.value, 0);
      const transactionFee = totalInputs - totalOutputs;

      psbt.validateSignaturesOfAllInputs(ecc.verify);
      psbt.finalizeAllInputs();

      const signedTransaction = psbt.extractTransaction();
      const transactionHex = signedTransaction.toHex();
      const transactionHash = signedTransaction.getId();

      return {
        signedTransaction: transactionHex,
        transactionHash,
        transactionSize: signedTransaction.byteLength(),
        transactionFee,
        signedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Failed to sign Bitcoin transaction:', error);
      throw new Error('Failed to sign Bitcoin transaction');
    }
  }

  /**
   * Get UTXO information for transaction input
   */
  // private async getUtxo(
  //   txid: string,
  //   vout: number,
  // ): Promise<{
  //   value: number;
  //   scriptPubKey: {
  //     hex: string;
  //     type: string;
  //   };
  // }> {
  //   try {
  //     const response = await fetch(`${this.config.rpcEndpoint}/tx/${txid}`);

  //     if (!response.ok) {
  //       throw new Error(`HTTP error! status: ${response.status}`);
  //     }

  //     const data = await response.json();
  //     return data.vout[vout];
  //   } catch (error) {
  //     this.logger.error('Failed to get UTXO:', error);
  //     throw new Error('Failed to get UTXO information');
  //   }
  // }

  /**
   * Broadcast Bitcoin transaction
   */
  async broadcastTransaction(signedTransactionHex: string): Promise<string> {
    try {
      const response = await fetch(`${this.config.rpcEndpoint}/tx`, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
        },
        body: signedTransactionHex,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.text();
      return data;
    } catch (error) {
      this.logger.error('Failed to broadcast Bitcoin transaction:', error);
      throw new Error('Failed to broadcast Bitcoin transaction');
    }
  }
}
