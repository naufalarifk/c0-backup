import type { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import type {
  BorrowerMatchingCriteria,
  CompatibleLoanOffer,
  LenderMatchingCriteria,
  MatchableLoanApplication,
} from './loan-matcher.types';

import { DiscoveryService } from '@nestjs/core';

export const MatcherStrategy = DiscoveryService.createDecorator<string>();

/**
 * Strategy types for loan matching
 */
export const MatcherStrategyType = {
  Standard: 'standard',
  Enhanced: 'enhanced',
  Targeted: 'targeted',
  Legacy: 'legacy',
} as const;

export type MatcherStrategyTypeValue =
  (typeof MatcherStrategyType)[keyof typeof MatcherStrategyType];

/**
 * Abstract base class for loan matching strategies
 * Similar to NotificationComposer pattern
 */
export abstract class LoanMatcherStrategy {
  protected repository?: CryptogadaiRepository;

  constructor(repository?: CryptogadaiRepository) {
    this.repository = repository;
  }

  /**
   * Find compatible loan offers for a given application
   * Each strategy implements its own matching logic
   */
  abstract findCompatibleOffers(
    application: MatchableLoanApplication,
    targetOfferId?: string,
    lenderCriteria?: LenderMatchingCriteria,
    borrowerCriteria?: BorrowerMatchingCriteria,
  ): Promise<CompatibleLoanOffer[]>;

  /**
   * Check if this strategy can handle the given criteria
   */
  abstract canHandle(
    lenderCriteria?: LenderMatchingCriteria,
    borrowerCriteria?: BorrowerMatchingCriteria,
    targetOfferId?: string,
    targetApplicationId?: string,
  ): boolean;

  /**
   * Get strategy description for logging
   */
  abstract getDescription(
    lenderCriteria?: LenderMatchingCriteria,
    borrowerCriteria?: BorrowerMatchingCriteria,
  ): string;
}
