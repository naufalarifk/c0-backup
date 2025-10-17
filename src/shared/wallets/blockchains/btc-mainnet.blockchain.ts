import { Injectable } from '@nestjs/common';

import * as bitcoin from 'bitcoinjs-lib';
import invariant from 'tiny-invariant';

import { Blockchain, BlockchainAbstract } from '../blockchain.abstract';
import { Wallet } from '../wallet.abstract';
import { WalletConfig } from '../wallet.config';
import { BitcoinRpcClient, BtcWallet } from '../wallets/btc.wallet';

export class BaseBitcoinRpcClient implements BitcoinRpcClient {
  constructor(
    private readonly rpcConfigs: Array<{
      url: string;
      method: string;
      authType: 'bearer' | 'none' | 'basic';
      apiKey?: string;
    }>,
  ) {}

  async sendRawTransaction(hexString: string): Promise<string> {
    const result = await this.makeRpcCall('sendrawtransaction', [hexString]);
    return result as string;
  }

  async getUnspentOutputs(address: string): Promise<
    {
      txid: string;
      vout: number;
      value: number;
      scriptPubKey: string;
    }[]
  > {
    // Use blockchain.info API as fallback for UTXO data
    try {
      const response = await fetch(`https://blockstream.info/api/address/${address}/utxo`);
      invariant(
        response.ok,
        `No response from blockstream.info ${response.status}: ${response.statusText}`,
      );

      const utxos = (await response.json()) as Array<{
        txid: string;
        vout: number;
        value: number;
        status?: Record<string, unknown>;
      }>;
      return utxos.map(utxo => ({
        txid: utxo.txid,
        vout: utxo.vout,
        value: utxo.value,
        scriptPubKey: '', // Will be filled by the wallet if needed
      }));
    } catch (error) {
      console.warn('Failed to get UTXOs from blockstream.info:', error);
      return []; // Return empty array if UTXO fetch fails
    }
  }

  private async makeRpcCall(method: string, params: unknown[]): Promise<unknown> {
    let lastError: Error;

    for (const config of this.rpcConfigs) {
      try {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Handle different auth types
        if (config.authType === 'bearer' && config.apiKey) {
          headers.Authorization = `Bearer ${config.apiKey}`;
        }

        const response = await fetch(config.url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
          }),
        });

        invariant(response.ok, `HTTP ${response.status}: ${response.statusText}`);

        const data = (await response.json()) as Record<string, unknown>;

        invariant(
          !data.error,
          `Bitcoin RPC Error: ${data.error && typeof data.error === 'object' && 'message' in data.error ? data.error.message : 'Unknown RPC error'}`,
        );

        return data.result; // Success, return immediately
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        console.warn(`Bitcoin RPC ${config.url} failed:`, lastError.message);
        // Continue to next RPC
      }
    }

    invariant(false, `All Bitcoin RPC endpoints failed. Last error: ${lastError!.message}`);
  }
}

class BitcoinMainnetRpcClient extends BaseBitcoinRpcClient {
  constructor() {
    super([
      {
        url: process.env.BITCOIN_RPC_URL || 'https://bitcoin.llamarpc.com',
        method: 'sendrawtransaction',
        authType: 'bearer',
        apiKey: process.env.BITCOIN_API_KEY,
      },
      {
        url: 'https://bitcoin.publicnode.com',
        method: 'sendrawtransaction',
        authType: 'none',
      },
      {
        url: 'https://go.getblock.io/mainnet',
        method: 'sendrawtransaction',
        authType: 'bearer',
        apiKey: process.env.GETBLOCK_API_KEY,
      },
      {
        url: 'https://btc.blockdaemon.com/mainnet',
        method: 'sendrawtransaction',
        authType: 'bearer',
        apiKey: process.env.BLOCKDAEMON_API_KEY,
      },
    ]);
  }
}

class BtcMainnetWallet extends BtcWallet {
  protected network = bitcoin.networks.bitcoin;
  protected rpcClient: BitcoinRpcClient;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, rpcClient: BitcoinRpcClient) {
    super(privateKey);
    this.rpcClient = rpcClient;
  }
}

@Injectable()
@Blockchain('bip122:000000000019d6689c085ae165831e93')
export class BtcMainnetBlockchain extends BlockchainAbstract {
  protected network = bitcoin.networks.bitcoin;

  constructor(private readonly walletConfig: WalletConfig) {
    super();
  }

  private _rpcClient?: BitcoinRpcClient;
  protected get rpcClient(): BitcoinRpcClient {
    if (!this._rpcClient) {
      this._rpcClient = this.createRpcClient();
    }
    return this._rpcClient;
  }

  protected createRpcClient(): BitcoinRpcClient {
    return new BitcoinMainnetRpcClient();
  }

  get bip44CoinType(): number {
    return 0;
  }

  async derivedPathToWallet(derivationPath: string): Promise<Wallet> {
    const masterKey = await this.walletConfig.getMasterKey();
    const { privateKey } = masterKey.derive(derivationPath);
    invariant(privateKey, 'Private key is undefined');
    return new BtcMainnetWallet(privateKey, this.rpcClient);
  }
}
