import { Injectable } from '@nestjs/common';

import { WalletService } from '../wallets/wallet.service';

export interface HotWalletConfig {
  blockchainKey: string;
  address: string;
  bip44CoinType: number;
}

@Injectable()
export class PlatformConfigService {
  private readonly hotWalletConfigCache = new Map<string, Promise<HotWalletConfig>>();

  constructor(private readonly platformWalletService: WalletService) {}

  async getHotWalletConfig(blockchainKey: string): Promise<HotWalletConfig> {
    let loadingConfig = this.hotWalletConfigCache.get(blockchainKey);

    if (!loadingConfig) {
      loadingConfig = this.platformWalletService.getHotWallet(blockchainKey).then(hotWallet => ({
        blockchainKey: hotWallet.blockchainKey,
        address: hotWallet.address,
        bip44CoinType: hotWallet.bip44CoinType,
      }));

      this.hotWalletConfigCache.set(blockchainKey, loadingConfig);
    }

    try {
      return await loadingConfig;
    } catch (error) {
      this.hotWalletConfigCache.delete(blockchainKey);
      throw error;
    }
  }

  async getHotWalletAddress(blockchainKey: string): Promise<string> {
    const config = await this.getHotWalletConfig(blockchainKey);
    return config.address;
  }
}
