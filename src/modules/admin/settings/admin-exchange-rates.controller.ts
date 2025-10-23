import type { UserSession } from '../../auth/types';

import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { validationOptions } from '../../../shared/utils/validation-options';
import { Session } from '../../auth/auth.decorator';
import { AdminExchangeRatesService } from './admin-exchange-rates.service';
import {
  ExchangeRateFeedResponseDto,
  ManualExchangeRateFeedDto,
} from './dto/admin-exchange-rates.dto';

@Controller('admin/exchange-rates')
@ApiTags('Admin - Exchange Rates')
@Auth(['Admin'])
export class AdminExchangeRatesController {
  private readonly logger = new TelemetryLogger(AdminExchangeRatesController.name);

  constructor(private readonly adminExchangeRatesService: AdminExchangeRatesService) {}

  @Post('feed')
  @ApiOperation({
    summary: 'Manually feed exchange rate',
    description:
      'Allows admin to manually input exchange rate data. The data will be dispatched to the pricefeed queue for processing by the PricefeedProcessor, which will store it and emit events for valuation processing.',
  })
  @ApiResponse({
    status: 200,
    description: 'Exchange rate feed dispatched successfully',
    type: ExchangeRateFeedResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Price feed not found' })
  async feedExchangeRate(
    @Session() session: UserSession,
    @Body(new ValidationPipe(validationOptions)) dto: ManualExchangeRateFeedDto,
  ): Promise<ExchangeRateFeedResponseDto> {
    try {
      this.logger.log('Admin manually feeding exchange rate', {
        adminId: session.user.id,
        adminEmail: session.user.email,
        priceFeedId: dto.priceFeedId,
      });

      const result = await this.adminExchangeRatesService.feedExchangeRate(dto);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error('Failed to feed exchange rate', {
        error: error instanceof Error ? error.message : String(error),
        adminId: session.user.id,
        priceFeedId: dto.priceFeedId,
      });
      throw error;
    }
  }
}
