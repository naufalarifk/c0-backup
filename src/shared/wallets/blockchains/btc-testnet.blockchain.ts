import { Injectable } from '@nestjs/common';

import * as bitcoin from 'bitcoinjs-lib';

import { Wallet } from '../wallet.abstract';
import { WalletProvider } from '../wallet.factory';
import { BitcoinRpcClient, BtcWallet } from '../wallets/btc.wallet';
import { BaseBitcoinRpcClient, BtcMainnetBlockchain } from './btc-mainnet.blockchain';

class BitcoinTestnetRpcClient extends BaseBitcoinRpcClient {
  constructor() {
    super([
      {
        url: process.env.BITCOIN_TESTNET_RPC_URL || 'https://bitcoin-testnet.publicnode.com',
        method: 'sendrawtransaction',
        authType: 'bearer',
        apiKey: process.env.BITCOIN_TESTNET_API_KEY,
      },
      {
        url: 'https://go.getblock.io/testnet',
        method: 'sendrawtransaction',
        authType: 'bearer',
        apiKey: process.env.GETBLOCK_TESTNET_API_KEY,
      },
      {
        url: 'https://btc-testnet.blockdaemon.com',
        method: 'sendrawtransaction',
        authType: 'bearer',
        apiKey: process.env.BLOCKDAEMON_TESTNET_API_KEY,
      },
    ]);
  }
}

class BtcTestnetWallet extends BtcWallet {
  protected network = bitcoin.networks.testnet;
  protected rpcClient: BitcoinRpcClient;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, rpcClient: BitcoinRpcClient) {
    super(privateKey);
    this.rpcClient = rpcClient;
  }
}

@Injectable()
@WalletProvider('bip122:000000000933ea01ad0ee984209779ba61f8d4362f5cb2f17e5e2c77d0d0dffc')
export class BtcTestnetWalletService extends BtcMainnetBlockchain {
  protected network = bitcoin.networks.testnet;

  get bip44CoinType(): number {
    return 1; // Bitcoin testnet coin type
  }

  protected createRpcClient(): BitcoinRpcClient {
    return new BitcoinTestnetRpcClient();
  }

  protected createWallet(privateKey: Uint8Array): Wallet {
    return new BtcTestnetWallet(privateKey, this.rpcClient);
  }
}
