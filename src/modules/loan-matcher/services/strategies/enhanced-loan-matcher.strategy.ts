import type {
  BorrowerMatchingCriteria,
  CompatibleLoanOffer,
  LenderMatchingCriteria,
  MatchableLoanApplication,
} from '../../loan-matcher.types';

import { Injectable, Logger } from '@nestjs/common';

import invariant from 'tiny-invariant';

import { CryptogadaiRepository } from '../../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../../shared/telemetry.logger';
import {
  LoanMatcherStrategy,
  MatcherStrategy,
  MatcherStrategyType,
} from './loan-matcher-strategy.abstract';

@Injectable()
@MatcherStrategy(MatcherStrategyType.Enhanced)
export class EnhancedLoanMatcherStrategy extends LoanMatcherStrategy {
  private readonly logger = new TelemetryLogger(EnhancedLoanMatcherStrategy.name);

  constructor(repository: CryptogadaiRepository) {
    super(repository);
  }

  canHandle(
    lenderCriteria?: LenderMatchingCriteria,
    borrowerCriteria?: BorrowerMatchingCriteria,
  ): boolean {
    return Boolean(lenderCriteria || borrowerCriteria);
  }

  getDescription(
    lenderCriteria?: LenderMatchingCriteria,
    borrowerCriteria?: BorrowerMatchingCriteria,
  ): string {
    const parts: string[] = [];

    if (borrowerCriteria) {
      parts.push(
        `Borrower: duration ${borrowerCriteria.fixedDuration || 'flexible'}mo, ` +
          `amount ${borrowerCriteria.fixedPrincipalAmount || 'flexible'}, ` +
          `max rate ${borrowerCriteria.maxInterestRate || 'any'}%, ` +
          `prefer institutions: ${borrowerCriteria.preferInstitutionalLenders || false}`,
      );
    }

    if (lenderCriteria) {
      parts.push(
        `Lender: duration options [${lenderCriteria.durationOptions?.join(', ') || 'any'}], ` +
          `fixed rate ${lenderCriteria.fixedInterestRate || 'any'}%`,
      );
    }

    return parts.join(' | ');
  }

  async findCompatibleOffers(
    application: MatchableLoanApplication,
    targetOfferId?: string,
    lenderCriteria?: LenderMatchingCriteria,
    borrowerCriteria?: BorrowerMatchingCriteria,
  ): Promise<CompatibleLoanOffer[]> {
    invariant(this.repository, 'Repository not available');

    const offers = await this.repository.platformListsAvailableLoanOffers({
      principalBlockchainKey: application.principalBlockchainKey,
      principalTokenId: application.principalTokenId,
      limit: 50,
    });

    type OfferType = (typeof offers.loanOffers)[number];
    let candidateOffers: OfferType[] = offers.loanOffers;

    // Apply lender criteria pre-filtering
    if (lenderCriteria) {
      candidateOffers = this.applyLenderCriteria(candidateOffers, lenderCriteria);
    }

    // Apply borrower criteria pre-filtering
    if (borrowerCriteria) {
      candidateOffers = this.applyBorrowerCriteria(candidateOffers, borrowerCriteria);
    }

    // Apply standard compatibility rules
    return this.filterCompatibleOffers(candidateOffers, application);
  }

  private applyLenderCriteria<
    T extends {
      id: string;
      interestRate: number;
      termInMonthsOptions: number[];
      minLoanPrincipalAmount: string;
      maxLoanPrincipalAmount: string;
    },
  >(offers: T[], lenderCriteria: LenderMatchingCriteria): T[] {
    return offers.filter(offer => {
      // Filter by lender's duration options
      if (lenderCriteria.durationOptions && lenderCriteria.durationOptions.length > 0) {
        const hasMatchingDuration = lenderCriteria.durationOptions.some(duration =>
          offer.termInMonthsOptions.includes(duration),
        );
        if (!hasMatchingDuration) {
          this.logger.debug(`Offer ${offer.id} rejected: Duration options don't overlap`);
          return false;
        }
      }

      // Filter by lender's fixed interest rate
      if (typeof lenderCriteria.fixedInterestRate === 'number') {
        if (Math.abs(offer.interestRate - lenderCriteria.fixedInterestRate) > 0.001) {
          this.logger.debug(
            `Offer ${offer.id} rejected: Interest rate mismatch (${offer.interestRate} vs ${lenderCriteria.fixedInterestRate})`,
          );
          return false;
        }
      }

      // Filter by lender's principal amount range
      if (lenderCriteria.minPrincipalAmount || lenderCriteria.maxPrincipalAmount) {
        const offerMin = parseFloat(offer.minLoanPrincipalAmount);
        const offerMax = parseFloat(offer.maxLoanPrincipalAmount);

        if (lenderCriteria.minPrincipalAmount) {
          const criteriaMin = parseFloat(lenderCriteria.minPrincipalAmount);
          if (offerMax < criteriaMin) {
            this.logger.debug(
              `Offer ${offer.id} rejected: Max amount ${offerMax} below criteria min ${criteriaMin}`,
            );
            return false;
          }
        }

        if (lenderCriteria.maxPrincipalAmount) {
          const criteriaMax = parseFloat(lenderCriteria.maxPrincipalAmount);
          if (offerMin > criteriaMax) {
            this.logger.debug(
              `Offer ${offer.id} rejected: Min amount ${offerMin} above criteria max ${criteriaMax}`,
            );
            return false;
          }
        }
      }

      return true;
    });
  }

  private applyBorrowerCriteria<
    T extends {
      id: string;
      interestRate: number;
      termInMonthsOptions: number[];
      minLoanPrincipalAmount: string;
      maxLoanPrincipalAmount: string;
      availablePrincipalAmount: string;
    },
  >(offers: T[], borrowerCriteria: BorrowerMatchingCriteria): T[] {
    return offers.filter(offer => {
      // Borrower rule 1: Fixed duration requirement
      if (typeof borrowerCriteria.fixedDuration === 'number') {
        if (!offer.termInMonthsOptions.includes(borrowerCriteria.fixedDuration)) {
          this.logger.debug(
            `Offer ${offer.id} rejected: Fixed duration ${borrowerCriteria.fixedDuration} not in options`,
          );
          return false;
        }
      }

      // Borrower rule 2: Fixed principal amount requirement
      if (borrowerCriteria.fixedPrincipalAmount) {
        const fixedAmount = parseFloat(borrowerCriteria.fixedPrincipalAmount);
        const minAmount = parseFloat(offer.minLoanPrincipalAmount);
        const maxAmount = parseFloat(offer.maxLoanPrincipalAmount);
        const availableAmount = parseFloat(offer.availablePrincipalAmount);

        if (fixedAmount < minAmount || fixedAmount > maxAmount) {
          this.logger.debug(
            `Offer ${offer.id} rejected: Fixed amount ${fixedAmount} outside range ${minAmount}-${maxAmount}`,
          );
          return false;
        }

        if (fixedAmount > availableAmount) {
          this.logger.debug(
            `Offer ${offer.id} rejected: Fixed amount ${fixedAmount} exceeds available ${availableAmount}`,
          );
          return false;
        }
      }

      // Borrower rule 3: Maximum acceptable interest rate
      if (typeof borrowerCriteria.maxInterestRate === 'number') {
        if (offer.interestRate > borrowerCriteria.maxInterestRate) {
          this.logger.debug(
            `Offer ${offer.id} rejected: Interest rate ${offer.interestRate}% exceeds max ${borrowerCriteria.maxInterestRate}%`,
          );
          return false;
        }
      }

      return true;
    });
  }

  private filterCompatibleOffers<
    T extends {
      id: string;
      interestRate: number;
      termInMonthsOptions: number[];
      minLoanPrincipalAmount: string;
      maxLoanPrincipalAmount: string;
      availablePrincipalAmount: string;
    },
  >(offers: T[], application: MatchableLoanApplication): T[] {
    return offers.filter(offer => {
      // Rule 1: Principal Amount Validation
      const requestedAmount = parseFloat(application.principalAmount);
      const minAmount = parseFloat(offer.minLoanPrincipalAmount);
      const maxAmount = parseFloat(offer.maxLoanPrincipalAmount);
      const availableAmount = parseFloat(offer.availablePrincipalAmount);

      if (requestedAmount < minAmount || requestedAmount > maxAmount) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Amount ${requestedAmount} outside range ${minAmount}-${maxAmount}`,
        );
        return false;
      }

      if (requestedAmount > availableAmount) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Amount ${requestedAmount} exceeds available ${availableAmount}`,
        );
        return false;
      }

      // Rule 2: Duration Validation
      if (!offer.termInMonthsOptions.includes(application.termInMonths)) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Term ${application.termInMonths}mo not in options`,
        );
        return false;
      }

      // Rule 3: Interest Rate Validation
      if (offer.interestRate > application.maxInterestRate) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Rate ${offer.interestRate}% exceeds max ${application.maxInterestRate}%`,
        );
        return false;
      }

      return true;
    });
  }
}
