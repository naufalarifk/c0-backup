import * as bitcoin from 'bitcoinjs-lib';
import * as ecPair from 'ecpair';
import * as ecc from 'tiny-secp256k1';

import { IWallet } from './Iwallet.types';

export interface BitcoinTransactionInput {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey?: string;
  witnessUtxo?: {
    script: Buffer;
    value: number;
  };
}

export interface BitcoinTransactionOutput {
  address: string;
  value: number;
}

export interface BitcoinTransactionData {
  inputs: BitcoinTransactionInput[];
  outputs: BitcoinTransactionOutput[];
  feeRate?: number;
}

export abstract class BaseBitcoinWallet implements IWallet {
  protected abstract network: bitcoin.Network;

  constructor(protected readonly privateKey: Uint8Array<ArrayBufferLike>) {}

  getAddress(): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const ECPair = ecPair.ECPairFactory(ecc);
        const keyPair = ECPair.fromPrivateKey(Buffer.from(this.privateKey));
        const publicKeyBuffer = Buffer.from(keyPair.publicKey);

        const { address } = bitcoin.payments.p2wpkh({
          pubkey: publicKeyBuffer,
          network: this.network,
        });

        if (!address) {
          throw new Error('Failed to generate address');
        }

        resolve(address);
      } catch (error) {
        reject(
          new Error(
            `Failed to get address: ${error instanceof Error ? error.message : 'Unknown error'}`,
          ),
        );
      }
    });
  }

  signTransaction<T>(transactionData: T): Promise<T> {
    return new Promise((resolve, reject) => {
      try {
        if (!this.isBitcoinTransactionData(transactionData)) {
          throw new Error('Invalid transaction data format');
        }

        const ECPair = ecPair.ECPairFactory(ecc);
        const keyPair: bitcoin.Signer = ECPair.fromPrivateKey(this.privateKey);
        const psbt = new bitcoin.Psbt({ network: this.network });

        // Add inputs to PSBT
        for (const input of transactionData.inputs) {
          const inputData = {
            hash: input.txid,
            index: input.vout,
            witnessUtxo: input.witnessUtxo || {
              script: Buffer.from(input.scriptPubKey || '', 'hex'),
              value: input.value,
            },
          };

          psbt.addInput(inputData);
        }

        // Add outputs to PSBT
        for (const output of transactionData.outputs) {
          psbt.addOutput({
            address: output.address,
            value: output.value,
          });
        }

        // Sign all inputs
        psbt.signAllInputs(keyPair);

        // Validate signatures
        if (!psbt.validateSignaturesOfAllInputs(() => true)) {
          throw new Error('Invalid signatures');
        }

        // Finalize all inputs
        psbt.finalizeAllInputs();

        // Extract signed transaction
        const signedTx = psbt.extractTransaction().toHex();

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
    });
  }

  protected isBitcoinTransactionData(data: unknown): data is BitcoinTransactionData {
    if (!data || typeof data !== 'object') return false;

    const obj = data as Record<string, unknown>;

    return (
      Array.isArray(obj.inputs) &&
      Array.isArray(obj.outputs) &&
      obj.inputs.every((input: unknown) => {
        if (!input || typeof input !== 'object') return false;
        const inputObj = input as Record<string, unknown>;
        return (
          typeof inputObj.txid === 'string' &&
          typeof inputObj.vout === 'number' &&
          typeof inputObj.value === 'number'
        );
      }) &&
      obj.outputs.every((output: unknown) => {
        if (!output || typeof output !== 'object') return false;
        const outputObj = output as Record<string, unknown>;
        return typeof outputObj.address === 'string' && typeof outputObj.value === 'number';
      })
    );
  }
}
