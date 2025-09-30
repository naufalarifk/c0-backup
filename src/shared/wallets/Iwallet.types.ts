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

  abstract getHotWallet(masterKey: HDKey): Promise<IWallet>;

  abstract derivedPathToWallet({
    masterKey,
    derivationPath,
  }: {
    masterKey: HDKey;
    derivationPath: string;
  }): Promise<IWallet>;

  getInvoiceDerivationPath(invoiceId: number): string {
    if (invoiceId < 0) {
      throw new WalletError(`Invoice ID must be positive. Received: ${invoiceId}`);
    }
    // Constrain invoice ID to valid BIP32 derivation range (0 to 2^31-1)
    // Use modulo to ensure we don't exceed the maximum index
    const constrainedId = invoiceId % 2147483647; // 2^31 - 1
    return `m/44'/${this.bip44CoinType}'/5'/0/${constrainedId}`;
  }

  async createInvoiceWallet(masterKey: HDKey, invoiceId: number): Promise<IWallet> {
    return await this.derivedPathToWallet({
      derivationPath: this.getInvoiceDerivationPath(invoiceId),
      masterKey,
    });
  }
}

export type WalletTransferParams = {
  tokenId: string;
  from: string;
  to: string;
  value: string;
};

export abstract class IWallet {
  abstract getAddress(): Promise<string>;
  abstract transfer(params: WalletTransferParams): Promise<{ txHash: string }>;
}

export class WalletError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WalletError';
  }
}
