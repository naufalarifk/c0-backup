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

  getAllBlockchains(): Array<{ blockchainKey: BlockchainKey; blockchain: BlockchainAbstract }> {
    const providers = this.discovery.getProviders();
    return providers
      .map(provider => {
        const blockchainKey = this.discovery.getMetadataByDecorator(Blockchain, provider);
        if (!blockchainKey) return null;
        const instance = provider.instance;
        if (!(instance instanceof BlockchainAbstract)) return null;
        return { blockchainKey: blockchainKey as BlockchainKey, blockchain: instance };
      })
      .filter(
        (item): item is { blockchainKey: BlockchainKey; blockchain: BlockchainAbstract } =>
          item !== null,
      );
  }
}
