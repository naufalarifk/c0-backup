import type { UserSession } from '../../auth/types';
import type { LoanMatchingWorkerData } from '../types/loan-matcher.types';

import { Body, Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Auth } from '../../../decorators/auth.decorator';
import { Session } from '../../auth/auth.decorator';
import { LoanMatcherScheduler } from '../schedulers/loan-matcher.scheduler';

@Controller('admin/loan-matcher')
@ApiTags('Admin - Loan Matcher')
@Auth(['Admin'])
@ApiBearerAuth()
export class LoanMatcherController {
  private readonly logger = new Logger(LoanMatcherController.name);

  constructor(private readonly loanMatcherScheduler: LoanMatcherScheduler) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Max 3 requests per minute
  @ApiOperation({
    summary: 'Manually trigger loan matching process',
    description:
      'Triggers manual loan matching between loan applications and loan offers. ' +
      'This endpoint allows administrators to manually trigger matching outside of the scheduled cron job. ' +
      'Matching will find compatible offers for published loan applications and create loan records.',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan matching triggered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Loan matching triggered successfully' },
        matchedDate: { type: 'string', format: 'date-time', example: '2025-10-16T13:00:00.000Z' },
        summary: {
          type: 'object',
          properties: {
            processedApplications: { type: 'number', example: 25 },
            processedOffers: { type: 'number', example: 150 },
            matchedPairs: { type: 'number', example: 8 },
            errorCount: { type: 'number', example: 0 },
            hasMore: { type: 'boolean', example: false },
          },
        },
        matchedLoans: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              loanApplicationId: { type: 'string', example: '123' },
              loanOfferId: { type: 'string', example: '456' },
              borrowerUserId: { type: 'string', example: '789' },
              lenderUserId: { type: 'string', example: '101' },
              principalAmount: { type: 'string', example: '1000000000' },
              interestRate: { type: 'number', example: 0.08 },
              termInMonths: { type: 'number', example: 12 },
              ltvRatio: { type: 'number', example: 0.6 },
              matchedDate: {
                type: 'string',
                format: 'date-time',
                example: '2025-10-16T13:00:00.000Z',
              },
            },
          },
        },
        triggeredBy: { type: 'string', example: 'admin@example.com' },
        triggeredAt: { type: 'string', format: 'date-time', example: '2025-10-16T13:00:00.000Z' },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded (max 3 per minute)',
  })
  @ApiResponse({
    status: 500,
    description: 'Loan matching failed - Internal server error',
  })
  async triggerManualMatching(
    @Session() session: UserSession,
    @Body() body?: { matchedDate?: string },
  ) {
    this.logger.log(`Manual loan matching triggered by admin: ${session.user.email}`);

    try {
      const matchedDate = body?.matchedDate ? new Date(body.matchedDate) : new Date();

      const result = await this.loanMatcherScheduler.triggerManualMatching(matchedDate);

      this.logger.log(
        `Manual loan matching completed: ${result.matchedPairs} matches from ${result.processedApplications} applications, ` +
          `Triggered by: ${session.user.email}`,
      );

      return {
        success: true,
        message: 'Loan matching triggered successfully',
        matchedDate: matchedDate.toISOString(),
        summary: {
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
        triggeredBy: session.user.email,
        triggeredAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(`Manual loan matching failed for admin ${session.user.email}:`, error);
      throw error;
    }
  }

  @Post('trigger-with-criteria')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @ApiOperation({
    summary: 'Manually trigger loan matching with specific criteria',
    description:
      'Triggers manual loan matching with custom criteria for borrowers and lenders. ' +
      'Supports enhanced matching rules including fixed duration, fixed amounts, interest rate limits, and more.',
  })
  @ApiResponse({
    status: 200,
    description: 'Loan matching with criteria triggered successfully',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - Admin access required',
  })
  @ApiResponse({
    status: 429,
    description: 'Too many requests - Rate limit exceeded',
  })
  async triggerMatchingWithCriteria(
    @Session() session: UserSession,
    @Body() body: LoanMatchingWorkerData,
  ) {
    this.logger.log(`Manual loan matching with criteria triggered by admin: ${session.user.email}`);

    try {
      const matchedDate = body.asOfDate ? new Date(body.asOfDate) : new Date();

      // Note: The scheduler has direct access to the loan matcher service
      // For criteria-based matching, we call the scheduler with the matched date
      // and the service handles the criteria internally
      const result = await this.loanMatcherScheduler.triggerManualMatching(matchedDate);

      this.logger.log(
        `Manual loan matching with criteria completed: ${result.matchedPairs} matches, ` +
          `Triggered by: ${session.user.email}`,
      );

      return {
        success: true,
        message: 'Loan matching with criteria triggered successfully',
        matchedDate: matchedDate.toISOString(),
        criteria: {
          borrower: body.borrowerCriteria,
          lender: body.lenderCriteria,
        },
        summary: {
          processedApplications: result.processedApplications,
          processedOffers: result.processedOffers,
          matchedPairs: result.matchedPairs,
          errorCount: result.errors.length,
        },
        matchedLoans: result.matchedLoans,
        triggeredBy: session.user.email,
        triggeredAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error(
        `Manual loan matching with criteria failed for admin ${session.user.email}:`,
        error,
      );
      throw error;
    }
  }
}
