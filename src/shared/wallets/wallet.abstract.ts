export type WalletTransferParams = {
  tokenId: string;
  from: string;
  to: string;
  value: string;
};

export abstract class Wallet {
  abstract getAddress(): Promise<string>;
  abstract transfer(params: WalletTransferParams): Promise<{ txHash: string }>;
}

export class WalletError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'WalletError';
  }
}
