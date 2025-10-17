import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { BlockchainKey } from '../constants/blockchain';
import { Blockchain, BlockchainAbstract } from './blockchain.abstract';

@Injectable()
export class WalletFactory {
  constructor(private readonly discovery: DiscoveryService) {}

  getBlockchain(blockchainKey: string): BlockchainAbstract {
    const providers = this.discovery.getProviders();
    const blockchains = providers
      .filter(provider => {
        return this.discovery.getMetadataByDecorator(Blockchain, provider) === blockchainKey;
      })
      .map(provider => provider.instance)
      .filter((instance): instance is BlockchainAbstract => instance instanceof BlockchainAbstract);
    const blockchain = blockchains[0];
    if (!blockchain) {
      throw new Error(`Unsupported blockchain key: ${blockchainKey}`);
    }
    return blockchain;
  }
}
