import { Injectable } from '@nestjs/common';

import { Connection, PublicKey } from '@solana/web3.js';

import { WalletFactory } from '../../../shared/wallets/wallet.factory';
import { SettlementWalletService } from './wallet.service';

// Solana blockchain keys (CAIP-2 format)
const SOLANA_MAINNET_KEY = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_TESTNET_KEY = 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z';

// Use testnet for testing, mainnet for production
const SOLANA_BLOCKCHAIN_KEY =
  process.env.SOLANA_USE_TESTNET === 'true' ? SOLANA_TESTNET_KEY : SOLANA_MAINNET_KEY;

@Injectable()
export class SolService {
  private _connection?: Connection;
  protected get connection(): Connection {
    if (!this._connection) {
      // Auto-detect RPC URL based on blockchain key if not explicitly set
      let rpcUrl = process.env.SOLANA_RPC_URL;
      if (!rpcUrl) {
        rpcUrl =
          SOLANA_BLOCKCHAIN_KEY === SOLANA_TESTNET_KEY
            ? 'https://api.testnet.solana.com'
            : 'https://api.mainnet-beta.solana.com';
      }
      this._connection = new Connection(rpcUrl);
    }
    return this._connection;
  }

  constructor(
    private readonly walletFactory: WalletFactory,
    private readonly walletService: SettlementWalletService,
  ) {}

  /**
   * Get Solana hot wallet balance
   * Uses the same approach as solana-balance.collector.ts line 82-88
   */
  async getBalance(): Promise<number> {
    // Get hot wallet using WalletFactory.getBlockchain() - same as solana-balance.collector.ts
    const blockchain = this.walletFactory.getBlockchain(SOLANA_BLOCKCHAIN_KEY);
    if (!blockchain) {
      throw new Error(`Unsupported blockchain: ${SOLANA_BLOCKCHAIN_KEY}`);
    }
    const hotWallet = await blockchain.getHotWallet();
    const address = await hotWallet.getAddress();

    const publicKey = new PublicKey(address);
    const balance = await this.connection.getBalance(publicKey);
    return balance;
  }

  /**
   * Get the current Solana blockchain key being used (mainnet or testnet)
   */
  getBlockchainKey(): string {
    return SOLANA_BLOCKCHAIN_KEY;
  }
}
