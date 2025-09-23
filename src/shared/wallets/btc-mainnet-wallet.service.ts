import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import * as bitcoin from 'bitcoinjs-lib';
import invariant from 'tiny-invariant';

import { BaseBitcoinWallet, BitcoinRpcClient } from './base-bitcoin-wallet';
import { WalletProvider } from './Iwallet.service';
import { IWallet, IWalletService } from './Iwallet.types';

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
            method: config.method,
            params: [hexString],
          }),
        });

        invariant(response.ok, `HTTP ${response.status}: ${response.statusText}`);

        const data = await response.json();

        invariant(!data.error, `Bitcoin RPC Error: ${data.error?.message || 'Unknown RPC error'}`);

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

class BtcMainnetWallet extends BaseBitcoinWallet {
  protected network = bitcoin.networks.bitcoin;
  protected rpcClient: BitcoinRpcClient;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, rpcClient: BitcoinRpcClient) {
    super(privateKey);
    this.rpcClient = rpcClient;
  }
}

@Injectable()
@WalletProvider('bip122:000000000019d6689c085ae165831e934ff763ae46a2a6c172b3f1b60a8ce26f')
export class BtcMainnetWalletService extends IWalletService {
  private readonly rpcClient: BitcoinRpcClient;

  constructor() {
    super();
    this.rpcClient = new BitcoinMainnetRpcClient();
  }

  get bip44CoinType(): number {
    return 0;
  }

  getHotWallet(masterKey: HDKey): Promise<IWallet> {
    return this.derivedPathToWallet({
      masterKey,
      derivationPath: `m/44'/${this.bip44CoinType}'/0'/10/0`,
    });
  }

  derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<IWallet> {
    return new Promise((resolve, reject) => {
      try {
        const { privateKey } = masterKey.derive(derivationPath);
        invariant(privateKey, 'Private key is undefined');
        resolve(new BtcMainnetWallet(privateKey, this.rpcClient));
      } catch (error) {
        reject(error instanceof Error ? error : new Error('Unknown error in wallet derivation'));
      }
    });
  }
}
