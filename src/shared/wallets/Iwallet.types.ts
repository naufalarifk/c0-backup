import { HDKey } from '@scure/bip32';

export interface EthereumTransactionParams {
  to: string;
  value: string;
  gasLimit?: number;
  gasPrice?: string;
  data?: string;
}

export interface SolanaTransactionParams {
  to: string;
  amount: number;
  memo?: string;
}
export abstract class IWalletFactory {
  abstract getWalletService(blockchainKey: string): IWalletService;
}

export abstract class IWalletService {
  abstract get bip44CoinType(): number;

  abstract derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<IWallet>;

  async createInvoiceWallet(masterKey: HDKey, invoiceId: number): Promise<IWallet> {
    return await this.derivedPathToWallet({
      derivationPath: `m/44'/${this.bip44CoinType}'/1200'/0/${invoiceId}`,
      masterKey,
    });
  }
}

export abstract class IWallet {
  abstract getAddress(): Promise<string>; // sd fklsjadfjasfdjk lskdfj lsdaflk
  abstract signTransaction<T>(message: T): Promise<T>;
}

export class WalletError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WalletError';
  }
}

import { DiscoveryService } from '@nestjs/core';
// === Example implementation of IWalletService and IWallet ===

// import { ICryptographyService } from '../cryptography/cryptography';
// import { HDKey } from '@scure/bip32';

export class WalletFactory implements IWalletFactory {
  #blockchainKeyToWalletServiceMap = {
    // 'eip155:1': EthereumWalletService,
    // TODO: Lengkapi
  };

  constructor(
    private discoveryService: DiscoveryService, // DiscoveryService from nestjs
  ) {}

  getWalletService(blockchainKey: string): IWalletService {
    const walletService = this.discoveryService
      .getProviders()
      .map(provider => provider.instance)
      .find((instance: unknown) => {
        return instance instanceof this.#blockchainKeyToWalletServiceMap[blockchainKey];
      });
    if (!(walletService instanceof IWalletService)) {
      throw new WalletError('WalletService not supported');
    }
    return walletService;
  }
}

// https://chainagnostic.org/CAIPs/caip-2#simple-summary
// export class EthereumWalletService implements IWalletService {
//   constructor(
//     private cryptographyService: ICryptographyService,
//   ) { }

//   async derivedPathToWallet(derivedPath: string): Promise<EthereumWallet> {
//     const HDWallet = HDKey.fromExtendedKey(derivedPath);
//     const privateKey = await this.cryptographyService.getPlatformPrivateKey();
//     const hdWallet = HDWallet(privateKey);
//     const derivedPrivateKeyPrivateKey = hdWallet.derivePath(derivedPath);
//     return new EthereumWallet(privateKey);
//   }
// }

// export class EthereumWallet implements IWallet {
//   constructor(
//     private privateKey: Uint8Array,
//   ) { }

// getAddress(): Promise<string> {
//     throw  new Error('TODO: implement getAddress from private key using viem');
//   }

//   signTransaction<T>(message: T): Promise<T> {
//     throw new Error('TODO: implement signTransaction using viem');
//   }
// }

// export class BitcoinWallet implements IWallet {
//     constructor(
//         private privateKey: Uint8Array,
//     ) { }
//     getAddress(): Promise<string> {
//         throw new Error('TODO: implement getAddress from private key using bitcoinjs-lib');
//     }
//     signTransaction<T>(message: T): Promise<T> {
//         throw new Error('TODO: implement signTransaction using bitcoinjs-lib');
//     }

// }
