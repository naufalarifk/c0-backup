import type { UserSession } from '../auth/types';

import { Controller, Get, HttpStatus, Logger, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { AccountsService } from '../accounts/accounts.service';
import {
  PortfolioAnalyticsResponseDto,
  PortfolioOverviewResponseDto,
} from '../accounts/dto/accounts.dto';
import { Session } from '../auth/auth.decorator';
import { AuthGuard } from '../auth/auth.guard';

@ApiTags('Portfolio Management')
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller('portfolio')
export class PortfolioController {
  private readonly logger = new Logger(PortfolioController.name);

  constructor(private readonly accountsService: AccountsService) {}

  /**
   * Get portfolio analytics for individual user home
   */
  @Get('analytics')
  @ApiOperation({
    summary: 'Get portfolio analytics for individual user home',
    description: `Retrieve comprehensive portfolio analytics specifically designed for the individual user home interface.

    **Key Metrics Provided:**
    - Total portfolio value with lock icon indicator
    - Interest growth metrics with percentage and amount
    - Active loan count aggregation
    - Date-specific portfolio data (e.g., "July 2025")
    - Loan payment due alerts and liquidation warnings
    - Performance tracking and historical data

    **UI Alignment:**
    This endpoint addresses audit discrepancy D01 by providing portfolio analytics
    that match UI requirements: "127,856.43 USDT", "+17.98% USDT", "125 Active Loans".`,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio analytics retrieved successfully',
    type: PortfolioAnalyticsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
  })
  async getPortfolioAnalytics(
    @Session() session: UserSession,
  ): Promise<PortfolioAnalyticsResponseDto> {
    const {
      user: { id },
    } = session;
    this.logger.log(`Getting portfolio analytics for user: ${id}`);
    return await this.accountsService.getPortfolioAnalytics(id);
  }

  /**
   * Get portfolio overview
   */
  @Get('overview')
  @ApiOperation({
    summary: 'Get portfolio overview',
    description: `Retrieve comprehensive portfolio overview including total value, asset allocation,
    and performance metrics for the authenticated user or institution.

    **Portfolio Calculations:**
    - Total value aggregated from all account balances
    - Asset allocation based on current market values
    - Performance metrics calculated from historical data
    - Real-time balance updates with latest exchange rates`,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Portfolio overview retrieved successfully',
    type: PortfolioOverviewResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - Invalid or missing authentication token',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - Insufficient permissions',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error',
  })
  async getPortfolioOverview(
    @Session() session: UserSession,
  ): Promise<PortfolioOverviewResponseDto> {
    const {
      user: { id },
    } = session;
    this.logger.log(`Getting portfolio overview for user: ${id}`);
    return await this.accountsService.getPortfolioOverview(id);
  }
}
