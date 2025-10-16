import type {
  BorrowerMatchingCriteria,
  CompatibleLoanOffer,
  LenderMatchingCriteria,
  LoanMatchingResult,
  LoanMatchingWorkerData,
  MatchableLoanApplication,
  MatchedLoanPair,
} from './loan-matcher.types';

import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';

import { assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../shared/telemetry.logger';
import { LoanCalculationService } from '../loans/services/loan-calculation.service';
import { LoansService } from '../loans/services/loans.service';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { MatcherStrategyType } from './loan-matcher-strategy.abstract';
import { LoanMatcherStrategyFactory } from './loan-matcher-strategy.factory';

@Injectable()
export class LoanMatcherService {
  private readonly logger = new TelemetryLogger(LoanMatcherService.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly strategyFactory: LoanMatcherStrategyFactory,
    @Inject(forwardRef(() => LoansService))
    private readonly loansService: LoansService,
    @Inject(forwardRef(() => LoanCalculationService))
    private readonly loanCalculationService: LoanCalculationService,
  ) {}

  /**
   * Process loan matching with given criteria
   * Finds compatible loan applications and offers, then creates matches
   */
  async processLoanMatching(data: LoanMatchingWorkerData): Promise<LoanMatchingResult> {
    const {
      batchSize = 50,
      asOfDate = new Date().toISOString(),
      targetApplicationId,
      targetOfferId,
      lenderCriteria,
      borrowerCriteria,
      criteria, // legacy support
    } = data;
    const processingDate = new Date(asOfDate);

    // Log different messages based on targeting and criteria
    if (targetApplicationId) {
      this.logger.log(`Starting targeted matching for application ${targetApplicationId}`);
    } else if (targetOfferId) {
      this.logger.log(`Starting targeted matching for offer ${targetOfferId}`);
    } else if (borrowerCriteria && lenderCriteria) {
      this.logger.log(
        `Starting enhanced matching - Borrower: duration ${borrowerCriteria.fixedDuration || 'flexible'}mo, amount ${borrowerCriteria.fixedPrincipalAmount || 'flexible'}, max rate ${borrowerCriteria.maxInterestRate || 'any'}%, prefer institutions: ${borrowerCriteria.preferInstitutionalLenders || false} | Lender: duration options [${lenderCriteria.durationOptions?.join(', ') || 'any'}], fixed rate ${lenderCriteria.fixedInterestRate || 'any'}%`,
      );
    } else if (borrowerCriteria) {
      this.logger.log(
        `Starting borrower criteria matching: duration ${borrowerCriteria.fixedDuration || 'flexible'}mo, amount ${borrowerCriteria.fixedPrincipalAmount || 'flexible'}, max rate ${borrowerCriteria.maxInterestRate || 'any'}%, prefer institutions: ${borrowerCriteria.preferInstitutionalLenders || false}`,
      );
    } else if (lenderCriteria) {
      this.logger.log(
        `Starting lender criteria matching: duration options [${lenderCriteria.durationOptions?.join(', ') || 'any'}], fixed rate ${lenderCriteria.fixedInterestRate || 'any'}%, amount ${lenderCriteria.minPrincipalAmount || '0'}-${lenderCriteria.maxPrincipalAmount || '∞'}`,
      );
    } else if (criteria) {
      this.logger.log(
        `Starting legacy criteria matching: ${criteria.duration}mo, ${criteria.interest}%, ${criteria.principalAmount}`,
      );
    } else {
      this.logger.log(`Starting batch loan matching process as of ${processingDate.toISOString()}`);
    }

    let processedApplications = 0;
    let processedOffers = 0;
    let matchedPairs = 0;
    const errors: string[] = [];
    const matchedLoans: MatchedLoanPair[] = [];
    let hasMore = true;
    let offset = 0;

    try {
      while (hasMore) {
        // Get available loan applications that need matching
        const applications = await this.getMatchableApplications(
          batchSize,
          offset,
          targetApplicationId,
        );

        if (applications.length === 0) {
          hasMore = false;
          break;
        }

        processedApplications += applications.length;

        this.logger.debug(
          `Processing batch of ${applications.length} loan applications (offset: ${offset})`,
        );

        // For each application, try to find compatible offers
        for (const application of applications) {
          try {
            const compatibleOffers = await this.findCompatibleOffers(
              application,
              data.targetOfferId,
              data.lenderCriteria,
              data.borrowerCriteria,
            );
            processedOffers += compatibleOffers.length;

            if (compatibleOffers.length > 0) {
              // Match with the best offer (first one, since they should be ordered by best terms)
              const bestOffer = compatibleOffers[0];

              const matchResult = await this.createLoanMatch(application, bestOffer);

              if (matchResult) {
                matchedLoans.push(matchResult);
                matchedPairs++;

                // Automatically originate and disburse loan after matching
                try {
                  const loanId = await this.originateLoanFromMatch(
                    matchResult,
                    application,
                    bestOffer,
                  );
                  this.logger.log(
                    `Loan originated successfully: ${loanId} for application ${application.id} and offer ${bestOffer.id}`,
                  );

                  // Automatically disburse the loan to activate it
                  try {
                    await this.repository.platformDisbursesPrincipal({
                      loanId,
                      disbursementDate: new Date(),
                    });
                    this.logger.log(`Loan disbursed successfully: ${loanId}`);
                  } catch (disbursementError) {
                    this.logger.error(
                      `Failed to disburse loan ${loanId}: ${disbursementError instanceof Error ? disbursementError.message : String(disbursementError)}`,
                    );
                    // Continue even if disbursement fails - loan is still originated
                  }
                } catch (error) {
                  this.logger.error(
                    `Failed to originate loan for match ${application.id} and ${bestOffer.id}: ${error instanceof Error ? error.message : String(error)}`,
                  );
                  // Continue even if origination fails - match is still valid
                }

                // Send notifications about the match
                await this.sendMatchNotifications(matchResult);

                this.logger.log(
                  `Matched loan application ${application.id} with offer ${bestOffer.id}`,
                );
              }
            }
          } catch (error) {
            const errorMsg = `Failed to process application ${application.id}: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error(errorMsg);
            errors.push(errorMsg);
          }
        }

        offset += batchSize;

        // Limit total processing to prevent runaway jobs
        if (offset >= 1000) {
          this.logger.warn('Reached processing limit, stopping to prevent runaway job');
          hasMore = false;
        }
      }

      this.logger.log(
        `Loan matching completed: processed ${processedApplications} applications, ` +
          `${processedOffers} offers, created ${matchedPairs} matches`,
      );

      return {
        processedApplications,
        processedOffers,
        matchedPairs,
        errors,
        matchedLoans,
        hasMore: offset < 1000 && hasMore,
      };
    } catch (error) {
      const errorMsg = `Loan matching process failed: ${error instanceof Error ? error.message : String(error)}`;
      this.logger.error(errorMsg);
      errors.push(errorMsg);

      return {
        processedApplications,
        processedOffers,
        matchedPairs,
        errors,
        matchedLoans,
        hasMore: false,
      };
    }
  }

  /**
   * Get loan applications that are ready for matching
   * These should be applications that are approved but not yet matched
   */
  private async getMatchableApplications(
    limit: number,
    offset: number,
    targetApplicationId?: string,
  ) {
    try {
      // If targeting a specific application, get it directly
      if (targetApplicationId) {
        // This would require a dedicated platform method to get a specific application
        // For now, we'll get all matchable applications and filter
        const result = await this.repository.platformListsMatchableLoanApplications({
          page: 1,
          limit: 100, // Get more to find the target
        });

        const targetApp = result.loanApplications.find(app => app.id === targetApplicationId);
        return targetApp ? [targetApp] : [];
      }

      // Get paginated matchable applications
      const page = Math.floor(offset / limit) + 1;
      const result = await this.repository.platformListsMatchableLoanApplications({
        page,
        limit,
      });

      this.logger.debug(
        `Retrieved ${result.loanApplications.length} matchable applications (page ${page}, limit ${limit})`,
      );

      return result.loanApplications;
    } catch (error) {
      this.logger.error(
        `Failed to get matchable applications: ${error instanceof Error ? error.message : String(error)}`,
      );
      return [];
    }
  }

  /**
   * Find loan offers that are compatible with the given application
   * Uses strategy pattern for different matching algorithms
   */
  private async findCompatibleOffers(
    application: MatchableLoanApplication,
    targetOfferId?: string,
    lenderCriteria?: LenderMatchingCriteria,
    borrowerCriteria?: BorrowerMatchingCriteria,
  ): Promise<CompatibleLoanOffer[]> {
    // Try to use enhanced strategy if criteria provided
    if (lenderCriteria || borrowerCriteria) {
      const strategy = this.strategyFactory.getStrategy(MatcherStrategyType.Enhanced);
      if (strategy) {
        this.logger.debug('Using enhanced matching strategy');
        return await strategy.findCompatibleOffers(
          application,
          targetOfferId,
          lenderCriteria,
          borrowerCriteria,
        );
      }
    }

    // Fallback to legacy matching logic
    return this.findCompatibleOffersLegacy(
      application,
      targetOfferId,
      lenderCriteria,
      borrowerCriteria,
    );
  }

  /**
   * Legacy matching logic (preserved for backward compatibility)
   */
  private async findCompatibleOffersLegacy(
    application: MatchableLoanApplication,
    targetOfferId?: string,
    lenderCriteria?: LenderMatchingCriteria,
    borrowerCriteria?: BorrowerMatchingCriteria,
  ): Promise<CompatibleLoanOffer[]> {
    if (targetOfferId) {
      this.logger.debug(
        `Finding specific offer ${targetOfferId} for application ${application.id}`,
      );
      // In production, this would fetch the specific offer by ID
      // For now, we'll check if it exists in the general query results
      const allOffers = await this.repository.platformListsAvailableLoanOffers({
        principalBlockchainKey: application.principalBlockchainKey,
        principalTokenId: application.principalTokenId,
        limit: 100, // Get more to find the specific one
      });

      const targetOffer = allOffers.loanOffers.find(offer => offer.id === targetOfferId);
      return targetOffer ? [targetOffer] : [];
    }

    // console.log(
    //   `[DEBUG] Fetching offers for application ${application.id}: ` +
    //     `principal ${application.principalBlockchainKey}:${application.principalTokenId} ` +
    //     `(collateral ${application.collateralBlockchainKey}:${application.collateralTokenId} is for reference only)`,
    // );

    const offers = await this.repository.platformListsAvailableLoanOffers({
      principalBlockchainKey: application.principalBlockchainKey,
      principalTokenId: application.principalTokenId,
      limit: 50, // Get up to 50 potential matches
    });

    // console.log(
    //   `[DEBUG] Retrieved ${offers.loanOffers.length} offers from repository for application ${application.id}`,
    // );

    // Pre-filter offers based on enhanced lender criteria if provided
    let candidateOffers = offers.loanOffers;

    if (lenderCriteria) {
      this.logger.debug('Applying enhanced lender criteria pre-filtering');

      candidateOffers = candidateOffers.filter(offer => {
        // Filter by lender's duration options
        if (lenderCriteria.durationOptions && lenderCriteria.durationOptions.length > 0) {
          const hasMatchingDuration = lenderCriteria.durationOptions.some(duration =>
            offer.termInMonthsOptions.includes(duration),
          );
          if (!hasMatchingDuration) {
            this.logger.debug(
              `Pre-filter rejected offer ${offer.id}: Duration options don't overlap`,
            );
            return false;
          }
        }

        // Filter by lender's fixed interest rate
        if (typeof lenderCriteria.fixedInterestRate === 'number') {
          if (Math.abs(offer.interestRate - lenderCriteria.fixedInterestRate) > 0.001) {
            this.logger.debug(
              `Pre-filter rejected offer ${offer.id}: Interest rate mismatch (${offer.interestRate} vs ${lenderCriteria.fixedInterestRate})`,
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
                `Pre-filter rejected offer ${offer.id}: Max amount ${offerMax} below criteria min ${criteriaMin}`,
              );
              return false;
            }
          }

          if (lenderCriteria.maxPrincipalAmount) {
            const criteriaMax = parseFloat(lenderCriteria.maxPrincipalAmount);
            if (offerMin > criteriaMax) {
              this.logger.debug(
                `Pre-filter rejected offer ${offer.id}: Min amount ${offerMin} above criteria max ${criteriaMax}`,
              );
              return false;
            }
          }
        }

        return true;
      });

      this.logger.debug(
        `Lender criteria pre-filtering reduced candidates from ${offers.loanOffers.length} to ${candidateOffers.length} offers`,
      );
    }

    // Apply borrower criteria pre-filtering
    if (borrowerCriteria) {
      this.logger.debug('Applying enhanced borrower criteria pre-filtering');

      candidateOffers = candidateOffers.filter(offer => {
        // Borrower rule 1: Fixed duration requirement
        if (typeof borrowerCriteria.fixedDuration === 'number') {
          if (!offer.termInMonthsOptions.includes(borrowerCriteria.fixedDuration)) {
            this.logger.debug(
              `Borrower pre-filter rejected offer ${offer.id}: Fixed duration ${borrowerCriteria.fixedDuration} not in options [${offer.termInMonthsOptions.join(', ')}]`,
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
              `Borrower pre-filter rejected offer ${offer.id}: Fixed amount ${fixedAmount} outside range ${minAmount}-${maxAmount}`,
            );
            return false;
          }

          if (fixedAmount > availableAmount) {
            this.logger.debug(
              `Borrower pre-filter rejected offer ${offer.id}: Fixed amount ${fixedAmount} exceeds available ${availableAmount}`,
            );
            return false;
          }
        }

        // Borrower rule 3: Maximum acceptable interest rate
        if (typeof borrowerCriteria.maxInterestRate === 'number') {
          if (offer.interestRate > borrowerCriteria.maxInterestRate) {
            this.logger.debug(
              `Borrower pre-filter rejected offer ${offer.id}: Interest rate ${offer.interestRate}% exceeds max ${borrowerCriteria.maxInterestRate}%`,
            );
            return false;
          }
        }

        return true;
      });

      this.logger.debug(
        `Borrower criteria pre-filtering reduced candidates to ${candidateOffers.length} offers`,
      );
    }

    // console.log(
    //   `[DEBUG] Starting compatibility check for ${candidateOffers.length} candidate offers against application ${application.id}`,
    // );
    // console.log(
    //   `[DEBUG] Application details: amount=${application.principalAmount}, term=${application.termInMonths}, maxRate=${application.maxInterestRate}`,
    // );

    // Filter offers that match the application requirements with enhanced lender rules
    const compatibleOffers = candidateOffers.filter(offer => {
      console.log(
        `[DEBUG] Checking offer ${offer.id}: ${offer.minLoanPrincipalAmount}-${offer.maxLoanPrincipalAmount} at ${offer.interestRate}% for [${offer.termInMonthsOptions.join(',')}] months`,
      );

      // Rule 1: Principal Amount Validation (Min/Max Range)
      const requestedAmount = parseFloat(application.principalAmount);
      const minAmount = parseFloat(offer.minLoanPrincipalAmount);
      const maxAmount = parseFloat(offer.maxLoanPrincipalAmount);
      const availableAmount = parseFloat(offer.availablePrincipalAmount);

      // Check if requested amount falls within lender's min/max range
      if (requestedAmount < minAmount) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Requested amount ${requestedAmount} below minimum ${minAmount}`,
        );
        return false;
      }

      if (requestedAmount > maxAmount) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Requested amount ${requestedAmount} above maximum ${maxAmount}`,
        );
        return false;
      }

      // Check if lender has sufficient available funds
      if (requestedAmount > availableAmount) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Requested amount ${requestedAmount} exceeds available ${availableAmount}`,
        );
        return false;
      }

      // Rule 2: Duration Options Validation (Multiple Choices Support)
      // Lenders can specify multiple duration options, borrower must request one of them
      if (!offer.termInMonthsOptions || offer.termInMonthsOptions.length === 0) {
        this.logger.debug(`Offer ${offer.id} rejected: No term options specified`);
        return false;
      }

      if (!offer.termInMonthsOptions.includes(application.termInMonths)) {
        console.log(
          `[DEBUG] Offer ${offer.id} rejected: Term ${application.termInMonths} months not in options [${offer.termInMonthsOptions.join(', ')}]`,
        );
        return false;
      }

      // Rule 3: Fixed Interest Rate Validation
      // Lender sets fixed interest rate, borrower must accept it (within their max acceptable rate)
      if (typeof offer.interestRate !== 'number' || offer.interestRate <= 0) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Invalid interest rate ${offer.interestRate}`,
        );
        return false;
      }

      // Check if borrower's maximum acceptable rate is compatible with lender's fixed rate
      if (
        application.maxInterestRate &&
        typeof application.maxInterestRate === 'number' &&
        offer.interestRate > application.maxInterestRate
      ) {
        console.log(
          `[DEBUG] Offer ${offer.id} rejected: Fixed rate ${offer.interestRate}% exceeds borrower's max ${application.maxInterestRate}%`,
        );
        return false;
      }

      // Additional validation: Ensure offer is still valid (not expired)
      const currentDate = new Date();
      if (offer.expirationDate && offer.expirationDate < currentDate) {
        this.logger.debug(
          `Offer ${offer.id} rejected: Expired on ${offer.expirationDate.toISOString()}`,
        );
        return false;
      }

      // Log successful match criteria
      console.log(
        `[DEBUG] ✅ Offer ${offer.id} passed validation: Amount ${requestedAmount} (${minAmount}-${maxAmount}), Term ${application.termInMonths}mo, Rate ${offer.interestRate}%`,
      );

      return true;
    });

    // Sort the offers with async institutional lender check
    const sortedOffers = await this.sortOffersByPreference(compatibleOffers, borrowerCriteria);
    return sortedOffers;
  }

  /**
   * Determine if a lender is institutional based on lender user ID
   */
  private async isInstitutionalLender(lenderUserId: string): Promise<boolean> {
    try {
      const userRepository = this.repository;
      const user = await userRepository.userViewsProfile({ userId: lenderUserId });
      this.logger.debug(`Lender ${lenderUserId} user type: ${user.userType}`);
      return user.userType === 'Institution';
    } catch (error) {
      this.logger.warn(`Failed to get user type for lender ${lenderUserId}:`, error);
      // Default to false (individual) if user lookup fails
      return false;
    }
  }

  /**
   * Sort offers by preference with institutional lender priority
   */
  private async sortOffersByPreference(
    offers: CompatibleLoanOffer[],
    borrowerCriteria?: BorrowerMatchingCriteria,
  ): Promise<CompatibleLoanOffer[]> {
    // Create array of offers with institutional lender status
    const offersWithLenderType = await Promise.all(
      offers.map(async offer => {
        const isInstitutional = await this.isInstitutionalLender(offer.lenderUserId);
        return { offer, isInstitutional };
      }),
    );

    // Sort with priority: institutional lenders first, then by interest rate
    return offersWithLenderType
      .sort((a, b) => {
        // Priority 1: Institutional lenders first
        if (a.isInstitutional && !b.isInstitutional) return -1;
        if (!a.isInstitutional && b.isInstitutional) return 1;

        // Priority 2: Lower interest rates first
        return a.offer.interestRate - b.offer.interestRate;
      })
      .map(item => item.offer);
  }

  /**
   * Calculate current collateral value using latest exchange rate
   */
  private async calculateCollateralValue(
    collateralBlockchainKey: string,
    collateralTokenId: string,
    collateralAmount: string,
  ): Promise<number> {
    try {
      // Get collateral currency decimals
      const currencyResult = await this.repository.sql`
        SELECT decimals FROM currencies
        WHERE blockchain_key = ${collateralBlockchainKey}
          AND token_id = ${collateralTokenId}
      `;

      if (currencyResult.length === 0) {
        this.logger.warn(
          `Collateral currency not found: ${collateralBlockchainKey}:${collateralTokenId}`,
        );
        return 0;
      }

      const currencyRow = currencyResult[0];
      assertDefined(currencyRow, 'Currency row should be defined');
      assertProp(check(isString, isNumber), currencyRow, 'decimals');
      const collateralDecimals = Number(currencyRow.decimals);

      // Get the latest exchange rate for the collateral token
      const exchangeRateRows = await this.repository.sql`
        SELECT 
          er.id,
          er.bid_price,
          er.ask_price,
          er.source_date
        FROM exchange_rates er
        JOIN price_feeds pf ON er.price_feed_id = pf.id
        WHERE pf.blockchain_key = ${collateralBlockchainKey}
          AND pf.base_currency_token_id = ${collateralTokenId}
        ORDER BY er.source_date DESC
        LIMIT 1
      `;

      if (exchangeRateRows.length === 0) {
        this.logger.warn(
          `No exchange rate found for collateral ${collateralBlockchainKey}:${collateralTokenId}`,
        );
        return 0;
      }

      const exchangeRate = exchangeRateRows[0] as {
        id: number;
        bid_price: number | string;
        ask_price: number | string;
        source_date: Date;
      };

      // Exchange rate is stored in smallest units (e.g., 1000000000000000000 for 1.0 USD)
      // We need to convert it to decimal form (assuming quote currency has 18 decimals)
      const QUOTE_CURRENCY_DECIMALS = 18;
      const bidPriceNum = Number(exchangeRate.bid_price);
      const bidPrice = bidPriceNum / Math.pow(10, QUOTE_CURRENCY_DECIMALS);

      // Collateral amount is also in smallest units, need to convert to decimal form
      const collateralAmountNum = Number(collateralAmount) / Math.pow(10, collateralDecimals);

      // Calculate current collateral value: amount * exchange rate (both in decimal form)
      const collateralValue = collateralAmountNum * bidPrice;

      return collateralValue;
    } catch (error) {
      this.logger.error('Failed to calculate collateral value:', error);
      return 0;
    }
  }

  /**
   * Create a loan match between application and offer
   */
  private async createLoanMatch(
    application: MatchableLoanApplication,
    offer: CompatibleLoanOffer,
  ): Promise<MatchedLoanPair | null> {
    try {
      // Calculate LTV ratio based on current collateral valuation
      // Returns value in decimal form (e.g., 1.0 for 1 USD)
      const collateralValueDecimal = await this.calculateCollateralValue(
        application.collateralBlockchainKey,
        application.collateralTokenId,
        application.collateralDepositAmount,
      );

      // Convert principal amount from smallest units to decimal form
      const principalAmountNum =
        Number(application.principalAmount) / Math.pow(10, application.principalCurrency.decimals);
      const ltvRatio = collateralValueDecimal > 0 ? principalAmountNum / collateralValueDecimal : 0;

      // Convert collateral value from decimal back to smallest units for storage (assuming 18 decimals for quote currency)
      const QUOTE_CURRENCY_DECIMALS = 18;
      const collateralValueSmallestUnits = Math.round(
        collateralValueDecimal * Math.pow(10, QUOTE_CURRENCY_DECIMALS),
      );

      const matchResult = await this.repository.platformMatchesLoanOffers({
        loanApplicationId: application.id,
        loanOfferId: offer.id,
        matchedDate: new Date(),
        matchedLtvRatio: ltvRatio,
        matchedCollateralValuationAmount: collateralValueSmallestUnits.toString(),
      });

      return {
        loanApplicationId: matchResult.loanApplicationId,
        loanOfferId: matchResult.loanOfferId,
        borrowerUserId: application.borrowerUserId,
        lenderUserId: offer.lenderUserId,
        principalAmount: application.principalAmount,
        interestRate: offer.interestRate,
        termInMonths: application.termInMonths,
        collateralValuationAmount: matchResult.matchedCollateralValuationAmount,
        ltvRatio: matchResult.matchedLtvRatio,
        matchedDate: matchResult.matchedDate,
      };
    } catch (error) {
      this.logger.error(
        `Failed to create loan match between application ${application.id} and offer ${offer.id}:`,
        error,
      );
      return null;
    }
  }

  /**
   * Send notifications to borrower and lender about the loan match
   */
  private async sendMatchNotifications(match: MatchedLoanPair): Promise<void> {
    try {
      // Notify borrower about the match
      await this.notificationQueueService.queueNotification({
        type: 'LoanApplicationMatched',
        userId: match.borrowerUserId,
        loanApplicationId: match.loanApplicationId,
        loanOfferId: match.loanOfferId,
        principalAmount: match.principalAmount,
        interestRate: match.interestRate.toString(),
        termInMonths: match.termInMonths.toString(),
        matchedDate: match.matchedDate.toISOString(),
      });

      // Notify lender about the match
      await this.notificationQueueService.queueNotification({
        type: 'LoanOfferMatched',
        userId: match.lenderUserId,
        loanApplicationId: match.loanApplicationId,
        loanOfferId: match.loanOfferId,
        amount: match.principalAmount,
        interestRate: match.interestRate.toString(),
        term: match.termInMonths.toString(),
        matchedDate: match.matchedDate.toISOString(),
      });

      this.logger.debug(`Sent match notifications for loan match ${match.loanApplicationId}`);
    } catch (error) {
      this.logger.error(`Failed to send match notifications:`, error);
      // Don't throw error as the match itself was successful
    }
  }

  /**
   * Originate loan from a matched loan application and offer
   */
  private async originateLoanFromMatch(
    match: MatchedLoanPair,
    application: MatchableLoanApplication,
    offer: CompatibleLoanOffer,
  ): Promise<string> {
    try {
      // Get platform provision rate
      const platformConfig = await this.repository.platformRetrievesProvisionRate();
      const provisionRate = Number(platformConfig.loanProvisionRate);

      // Calculate all loan origination parameters
      const originationParams = this.loanCalculationService.calculateLoanOriginationParams({
        principalAmount: match.principalAmount,
        interestRate: match.interestRate,
        termInMonths: match.termInMonths,
        collateralAmount: application.collateralDepositAmount,
        matchedLtvRatio: match.ltvRatio,
        matchedCollateralValuationAmount: match.collateralValuationAmount,
        provisionRate,
      });

      // Originate the loan
      const result = await this.loansService.originateLoan({
        loanOfferId: match.loanOfferId,
        loanApplicationId: match.loanApplicationId,
        principalAmount: originationParams.principalAmount,
        interestAmount: originationParams.interestAmount,
        repaymentAmount: originationParams.repaymentAmount,
        redeliveryFeeAmount: originationParams.redeliveryFeeAmount,
        redeliveryAmount: originationParams.redeliveryAmount,
        premiAmount: originationParams.premiAmount,
        liquidationFeeAmount: originationParams.liquidationFeeAmount,
        minCollateralValuation: originationParams.minCollateralValuation,
        mcLtvRatio: originationParams.mcLtvRatio,
        collateralAmount: originationParams.collateralAmount,
        originationDate: match.matchedDate,
        maturityDate: originationParams.maturityDate,
      });

      this.logger.debug(
        `Loan originated for application ${match.loanApplicationId} and offer ${match.loanOfferId}`,
      );

      return result.loanId;
    } catch (error) {
      this.logger.error(
        `Failed to originate loan from match: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
