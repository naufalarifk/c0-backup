import { Injectable, OnModuleInit } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { IWalletFactory, IWalletService } from './Iwallet.types';

const BLOCKCHAIN_KEY = 'BLOCKCHAIN_KEY';
export const WalletProvider = (key: string) => Reflect.metadata(BLOCKCHAIN_KEY, key);

@Injectable()
export class WalletFactory implements IWalletFactory, OnModuleInit {
  private services = new Map<string, IWalletService>();

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  onModuleInit() {
    const providers = this.discovery.getProviders();

    for (const provider of providers) {
      const { instance } = provider;
      if (!instance) continue;

      const blockchainKey = this.reflector.get<string>(BLOCKCHAIN_KEY, instance.constructor);

      if (blockchainKey && 'derivedPathToWallet' in instance) {
        this.services.set(blockchainKey, instance as IWalletService);
      }
    }

    console.log(`WalletFactory initialized with:`, [...this.services.keys()]);
  }

  getWalletService(blockchainKey: string): IWalletService {
    const service = this.services.get(blockchainKey);
    if (!service) throw new Error(`Wallet service not found: ${blockchainKey}`);
    return service;
  }
}
