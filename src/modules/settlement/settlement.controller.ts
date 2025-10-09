import type { UserSession } from '../auth/types';
import type { SettlementResult } from './settlement.types';

import { Controller, HttpCode, HttpStatus, Logger, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Auth } from '../../decorators/auth.decorator';
import { Session } from '../auth/auth.decorator';
import { SettlementScheduler } from './settlement.scheduler';

/*
@todo
1. transfer from wallet to binance
2. transfer from binance to wallet
3. check balance
4. admin could manually transfer
*/
@Controller('admin/settlement')
@ApiTags('Admin - Settlement')
@Auth(['Admin'])
@ApiBearerAuth()
export class SettlementController {
  private readonly logger = new Logger(SettlementController.name);

  constructor(private readonly settlementScheduler: SettlementScheduler) {}

  @Post('trigger')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // Max 3 requests per minute
  @ApiOperation({
    summary: 'Manually trigger settlement process',
    description:
      'Triggers manual settlement between hot wallets and Binance exchange. ' +
      'This endpoint allows administrators to manually rebalance assets outside of the scheduled cron job. ' +
      'Settlement will transfer assets to/from Binance to maintain the configured target percentage.',
  })
  @ApiResponse({
    status: 200,
    description: 'Settlement triggered successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Settlement triggered successfully' },
        results: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              asset: { type: 'string', example: 'USDT' },
              success: { type: 'boolean', example: true },
              action: {
                type: 'string',
                enum: ['deposit', 'withdraw', 'skip'],
                example: 'deposit',
              },
              settlementAmount: { type: 'string', example: '1500.50' },
              fromNetwork: { type: 'string', example: 'ETH' },
              toNetwork: { type: 'string', example: 'BSC' },
              message: { type: 'string', example: 'Successfully deposited 1500.50 USDT from ETH' },
            },
          },
        },
        triggeredBy: { type: 'string', example: 'admin@example.com' },
        triggeredAt: { type: 'string', format: 'date-time', example: '2025-10-08T12:00:00.000Z' },
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
    description: 'Settlement failed - Internal server error',
  })
  async triggerManualSettlement(@Session() session: UserSession) {
    this.logger.log(`Manual settlement triggered by admin: ${session.user.email}`);

    try {
      const results: SettlementResult[] = await this.settlementScheduler.triggerManualSettlement();

      const successCount = results.filter(r => r.success).length;
      const totalAmount = results
        .filter(r => r.success)
        .reduce((sum, r) => sum + Number.parseFloat(r.settlementAmount), 0);

      this.logger.log(
        `Manual settlement completed: ${successCount}/${results.length} succeeded, ` +
          `Total: ${totalAmount.toFixed(2)}, Triggered by: ${session.user.email}`,
      );

      return {
        success: true,
        message: 'Settlement triggered successfully',
        results,
        triggeredBy: session.user.email,
        triggeredAt: new Date().toISOString(),
        summary: {
          total: results.length,
          succeeded: successCount,
          failed: results.length - successCount,
          totalAmount: totalAmount.toFixed(2),
        },
      };
    } catch (error) {
      this.logger.error(`Manual settlement failed for admin ${session.user.email}:`, error);
      throw error;
    }
  }
}
