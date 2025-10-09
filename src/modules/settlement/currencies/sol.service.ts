import { Injectable } from '@nestjs/common';

import { Connection, PublicKey } from '@solana/web3.js';

import { WalletFactory } from '../../../shared/wallets/wallet.factory';
import { SettlementWalletService } from './wallet.service';

@Injectable()
export class SolService {
  private _connection?: Connection;
  protected get connection(): Connection {
    if (!this._connection) {
      const rpcUrl = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      this._connection = new Connection(rpcUrl);
    }
    return this._connection;
  }

  constructor(
    private readonly walletFactory: WalletFactory,
    private readonly walletService: SettlementWalletService,
  ) {}

  async getBalance(): Promise<number> {
    const solWallet = await this.walletService.getHotWallet('solana:mainnet');
    const address = await solWallet.wallet.getAddress();
    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return balance;
  }
}
