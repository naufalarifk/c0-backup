import { Injectable } from '@nestjs/common';
import { DiscoveryService, ModuleRef } from '@nestjs/core';

import { BtcWalletService } from './btc-wallet.service';
import { EthWalletService } from './eth-wallet.service';
import { FeatureFlag } from './feature-flag.decorator';
import { SolWalletService } from './sol-wallet.service';

export type BlockchainKey = {
  key: 'btc' | 'eth' | 'sol';
  name: string;
  short_name: string;
  image: string;
};

// Union type for wallet services
type WalletService = BtcWalletService | EthWalletService | SolWalletService;

@Injectable()
export class WalletInstanceService {
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly moduleRef: ModuleRef,
  ) {}

  // Method overloads for specific return types based on blockchainKey
  getProvider(blockchainKey: BlockchainKey): BtcWalletService;
  getProvider(blockchainKey: BlockchainKey): EthWalletService;
  getProvider(blockchainKey: BlockchainKey): SolWalletService;
  getProvider(blockchainKey: BlockchainKey): WalletService {
    const [provider] = this.discoveryService
      .getProviders()
      .filter(
        item =>
          this.discoveryService.getMetadataByDecorator(FeatureFlag, item) === blockchainKey.key,
      );

    if (!provider) {
      throw new Error(`No provider found for blockchainKey: ${blockchainKey.key}`);
    }

    const ServiceClass = provider.token;
    const serviceInstance = this.moduleRef.get(ServiceClass, { strict: false });

    console.log('Service Token:', ServiceClass);
    console.log('Service Instance:', serviceInstance);
    console.log('Service Constructor:', serviceInstance?.constructor?.name);

    return serviceInstance;
  }
}
