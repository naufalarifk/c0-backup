import { createHash, randomUUID } from 'node:crypto';

import { Wallet, type WalletTransferParams } from '../wallet.abstract';

export class CgtWallet extends Wallet {
  constructor(private readonly privateKey: Uint8Array) {
    super();
  }

  async getAddress(): Promise<string> {
    const hash = createHash('sha256').update(this.privateKey).digest('hex');
    return `0xmock${hash.slice(0, 34)}`;
  }

  async transfer(params: WalletTransferParams): Promise<{ txHash: string }> {
    const seed = `${params.tokenId}:${params.to}:${params.value}:${randomUUID()}`;
    const hash = createHash('sha256').update(seed).digest('hex');
    return { txHash: `0xmock${hash.slice(0, 58)}` };
  }
}
