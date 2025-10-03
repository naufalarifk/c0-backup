import type { MatcherStrategyTypeValue } from './loan-matcher-strategy.abstract';

import { Injectable } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { LoanMatcherStrategy, MatcherStrategy } from './loan-matcher-strategy.abstract';

@Injectable()
export class LoanMatcherStrategyFactory {
  constructor(private readonly discoveryService: DiscoveryService) {}

  /**
   * Get a matcher strategy by type
   * Similar to NotificationComposerFactory.getComposer()
   */
  getStrategy(strategyType: MatcherStrategyTypeValue): LoanMatcherStrategy | undefined {
    const providers = this.discoveryService.getProviders();
    const strategy = providers.find(provider => {
      return (
        this.discoveryService.getMetadataByDecorator(MatcherStrategy, provider) === strategyType
      );
    })?.instance;
    return strategy instanceof LoanMatcherStrategy ? strategy : undefined;
  }

  /**
   * Get all available strategies
   */
  getAllStrategies(): LoanMatcherStrategy[] {
    const providers = this.discoveryService.getProviders();
    return providers
      .filter(provider => {
        return (
          this.discoveryService.getMetadataByDecorator(MatcherStrategy, provider) !== undefined
        );
      })
      .map(provider => provider.instance)
      .filter(
        (instance): instance is LoanMatcherStrategy => instance instanceof LoanMatcherStrategy,
      );
  }
}
