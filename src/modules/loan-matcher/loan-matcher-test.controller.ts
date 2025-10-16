/**
 * Loan Matcher Test Controller
 *
 * Provides test endpoints for E2E testing of loan matching functionality.
 * These endpoints are only available in non-production environments.
 *
 * @internal
 */

import type { LoanMatchingWorkerData } from './loan-matcher.types';

import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { LoanMatcherScheduler } from './schedulers/loan-matcher.scheduler';
import { LoanMatcherService } from './services/core/loan-matcher.service';

@Controller('test/loan-matcher')
@ApiTags('Testing - Loan Matcher')
@Auth({ public: true })
export class LoanMatcherTestController {
  constructor(
    private readonly loanMatcherService: LoanMatcherService,
    private readonly loanMatcherScheduler: LoanMatcherScheduler,
  ) {}

  /**
   * Manually trigger loan matching process
   * This will match all available loan applications with compatible offers
   */
  @Post('execute-matching')
  async executeMatching(@Body() body?: { matchedDate?: string; batchSize?: number }) {
    try {
      const matchedDate = body?.matchedDate ? new Date(body.matchedDate) : new Date();

      const result = await this.loanMatcherService.processLoanMatching({
        asOfDate: matchedDate.toISOString(),
        batchSize: body?.batchSize || 50,
      });

      return {
        success: true,
        message: `Loan matching executed: ${result.matchedPairs} matches created`,
        matchedDate: matchedDate.toISOString(),
        statistics: {
          processedApplications: result.processedApplications,
          processedOffers: result.processedOffers,
          matchedPairs: result.matchedPairs,
          errorCount: result.errors.length,
          hasMore: result.hasMore,
        },
        matchedLoans: result.matchedLoans.map(loan => ({
          loanApplicationId: loan.loanApplicationId,
          loanOfferId: loan.loanOfferId,
          borrowerUserId: loan.borrowerUserId,
          lenderUserId: loan.lenderUserId,
          principalAmount: loan.principalAmount,
          interestRate: loan.interestRate,
          termInMonths: loan.termInMonths,
          ltvRatio: loan.ltvRatio,
          matchedDate: loan.matchedDate.toISOString(),
        })),
        errors: result.errors,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Trigger manual matching via scheduler
   * This uses the scheduler's manual trigger which includes additional logging
   */
  @Post('trigger-scheduler')
  async triggerScheduler(@Body() body?: { matchedDate?: string }) {
    try {
      const matchedDate = body?.matchedDate ? new Date(body.matchedDate) : new Date();

      const result = await this.loanMatcherScheduler.triggerManualMatching(matchedDate);

      return {
        success: true,
        message: 'Loan matching triggered via scheduler',
        matchedDate: matchedDate.toISOString(),
        result: {
          processedApplications: result.processedApplications,
          processedOffers: result.processedOffers,
          matchedPairs: result.matchedPairs,
          errorCount: result.errors.length,
          hasMore: result.hasMore,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Match specific loan application with compatible offers
   */
  @Post('match-application/:applicationId')
  async matchSpecificApplication(
    @Param('applicationId') applicationId: string,
    @Body() body?: { matchedDate?: string },
  ) {
    try {
      const matchedDate = body?.matchedDate ? new Date(body.matchedDate) : new Date();

      const result = await this.loanMatcherService.processLoanMatching({
        targetApplicationId: applicationId,
        asOfDate: matchedDate.toISOString(),
      });

      return {
        success: true,
        message: `Processed application ${applicationId}`,
        applicationId,
        matchedDate: matchedDate.toISOString(),
        result: {
          matched: result.matchedPairs > 0,
          matchedPairs: result.matchedPairs,
          processedOffers: result.processedOffers,
          errors: result.errors,
        },
        matchedLoan: result.matchedLoans.length > 0 ? result.matchedLoans[0] : null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        applicationId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Match specific loan offer with compatible applications
   */
  @Post('match-offer/:offerId')
  async matchSpecificOffer(
    @Param('offerId') offerId: string,
    @Body() body?: { matchedDate?: string },
  ) {
    try {
      const matchedDate = body?.matchedDate ? new Date(body.matchedDate) : new Date();

      const result = await this.loanMatcherService.processLoanMatching({
        targetOfferId: offerId,
        asOfDate: matchedDate.toISOString(),
      });

      return {
        success: true,
        message: `Processed offer ${offerId}`,
        offerId,
        matchedDate: matchedDate.toISOString(),
        result: {
          matched: result.matchedPairs > 0,
          matchedPairs: result.matchedPairs,
          processedApplications: result.processedApplications,
          errors: result.errors,
        },
        matchedLoans: result.matchedLoans,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        offerId,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Match with specific criteria
   */
  @Post('match-with-criteria')
  async matchWithCriteria(@Body() body: LoanMatchingWorkerData) {
    try {
      const matchedDate = body.asOfDate ? new Date(body.asOfDate) : new Date();

      const result = await this.loanMatcherService.processLoanMatching({
        ...body,
        asOfDate: matchedDate.toISOString(),
      });

      return {
        success: true,
        message: 'Loan matching with criteria completed',
        matchedDate: matchedDate.toISOString(),
        criteria: {
          borrower: body.borrowerCriteria,
          lender: body.lenderCriteria,
        },
        result: {
          processedApplications: result.processedApplications,
          processedOffers: result.processedOffers,
          matchedPairs: result.matchedPairs,
          errorCount: result.errors.length,
        },
        matchedLoans: result.matchedLoans,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get matching statistics
   */
  @Get('statistics')
  async getStatistics() {
    try {
      // This would query the database for matching statistics
      // For now, return basic info
      return {
        success: true,
        message: 'Statistics endpoint (placeholder)',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
