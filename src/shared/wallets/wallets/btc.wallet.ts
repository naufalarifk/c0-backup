import * as bitcoin from 'bitcoinjs-lib';
import * as ecPair from 'ecpair';
import invariant from 'tiny-invariant';
import * as ecc from 'tiny-secp256k1';

import { Wallet, WalletTransferParams } from '../wallet.abstract';

export interface BitcoinRpcClient {
  sendRawTransaction(hexString: string): Promise<string>;
  getUnspentOutputs(address: string): Promise<
    {
      txid: string;
      vout: number;
      value: number;
      scriptPubKey: string;
    }[]
  >;
}

export abstract class BtcWallet extends Wallet {
  protected abstract network: bitcoin.Network;
  protected abstract rpcClient: BitcoinRpcClient;

  constructor(protected readonly privateKey: Uint8Array<ArrayBufferLike>) {
    super();
  }

  async getAddress(): Promise<string> {
    const ECPair = ecPair.ECPairFactory(ecc);
    const keyPair = ECPair.fromPrivateKey(Buffer.from(this.privateKey));
    const publicKeyBuffer = Buffer.from(keyPair.publicKey);

    const { address } = bitcoin.payments.p2wpkh({
      pubkey: publicKeyBuffer,
      network: this.network,
    });
    invariant(address, 'Address generation failed');

    return address;
  }

  async transfer(params: WalletTransferParams): Promise<{ txHash: string }> {
    try {
      const ECPair = ecPair.ECPairFactory(ecc);
      const keyPair: bitcoin.Signer = ECPair.fromPrivateKey(this.privateKey);
      const senderAddress = await this.getAddress();

      // Get unspent outputs
      const utxos = await this.rpcClient.getUnspentOutputs(senderAddress);

      invariant(utxos.length > 0, 'No unspent outputs available');

      const psbt = new bitcoin.Psbt({ network: this.network });
      const amountSatoshis = Math.floor(parseFloat(params.value) * 100000000); // Convert to satoshis
      const feeRate = 1; // 1 sat/byte

      let totalInput = 0;

      // Add inputs
      for (const utxo of utxos) {
        psbt.addInput({
          hash: utxo.txid,
          index: utxo.vout,
          witnessUtxo: {
            script: Buffer.from(utxo.scriptPubKey, 'hex'),
            value: BigInt(utxo.value),
          },
        });
        totalInput += utxo.value;

        if (totalInput >= amountSatoshis + 1000) break; // Rough fee estimation
      }

      invariant(totalInput >= amountSatoshis, 'Insufficient funds');

      // Add output to recipient
      psbt.addOutput({
        address: params.to,
        value: BigInt(amountSatoshis),
      });

      // Add change output if needed
      const estimatedFee = 250 * feeRate; // Rough estimation
      const change = totalInput - amountSatoshis - estimatedFee;

      if (change > 546) {
        // Dust limit
        psbt.addOutput({
          address: senderAddress,
          value: BigInt(change),
        });
      }

      // Sign all inputs
      psbt.signAllInputs(keyPair);

      // Validate and finalize
      invariant(
        psbt.validateSignaturesOfAllInputs(() => true),
        'Invalid signatures',
      );
      psbt.finalizeAllInputs();

      // Extract and send transaction
      const signedTx = psbt.extractTransaction().toHex();
      const txHash = await this.rpcClient.sendRawTransaction(signedTx);

      return { txHash };
    } catch (error) {
      invariant(
        false,
        `Transfer failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
