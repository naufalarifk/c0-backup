import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { Connection } from '@solana/web3.js';

import { TelemetryLogger } from '../../telemetry.logger';
import { Blockchain, BlockchainAbstract } from '../blockchain.abstract';
import { WalletConfig } from '../wallet.config';
import { SolWallet } from '../wallets/sol.wallet';

class SolanaMainnetWallet extends SolWallet {
  protected connection: Connection;

  constructor(privateKey: Uint8Array<ArrayBufferLike>, connection: Connection) {
    super(privateKey);
    this.connection = connection;
  }
}

@Injectable()
@Blockchain('solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp')
export class SolMainnetBlockchain extends BlockchainAbstract {
  constructor(private readonly walletConfig: WalletConfig) {
    super();
  }

  rpcUrl = 'https://api.mainnet-beta.solana.com';

  #connection?: Connection;
  protected get connection(): Connection {
    if (!this.#connection) {
      this.#connection = new Connection(this.rpcUrl);
    }
    return this.#connection;
  }

  get bip44CoinType(): number {
    return 501;
  }

  async derivedPathToWallet(derivationPath: string): Promise<SolanaMainnetWallet> {
    const masterKey = await this.walletConfig.getMasterKey();
    const { privateKey } = masterKey.derive(derivationPath);
    if (!privateKey) {
      throw new Error('Private key is undefined');
    }
    return new SolanaMainnetWallet(privateKey, this.connection);
  }
}
