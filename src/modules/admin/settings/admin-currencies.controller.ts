import type { UserSession } from '../../auth/types';

import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Auth } from '../../../decorators/auth.decorator';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { validationOptions } from '../../../shared/utils/validation-options.js';
import { Session } from '../../auth/auth.decorator';
import { AdminCurrenciesService } from './admin-currencies.service';
import {
  CurrencyConfigResponseDto,
  CurrencyConfigUpdateDto,
  CurrencyListResponseDto,
} from './dto/admin-currencies.dto';

@Controller('admin/currencies')
@ApiTags('Admin - Currency Management')
@Auth(['Admin'])
export class AdminCurrenciesController {
  private readonly logger = new TelemetryLogger(AdminCurrenciesController.name);

  constructor(private readonly adminCurrenciesService: AdminCurrenciesService) {}

  @Get()
  @ApiOperation({
    summary: 'Get all currencies and their configurations',
    description: 'Retrieve all supported currencies and their current configuration settings.',
  })
  @ApiResponse({
    status: 200,
    description: 'Currencies retrieved successfully',
    type: CurrencyListResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  async getCurrencies(): Promise<CurrencyListResponseDto> {
    try {
      this.logger.log('Getting all currencies with configurations');
      const currencies = await this.adminCurrenciesService.getCurrencies();
      return {
        success: true,
        data: {
          currencies,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get currencies', { error: error.message });
      throw error;
    }
  }

  @Put(':blockchainKey/:tokenId')
  @ApiOperation({
    summary: 'Update currency configuration',
    description: 'Update configuration settings for a specific currency.',
  })
  @ApiParam({
    name: 'blockchainKey',
    description: 'Blockchain identifier (CAIP-2 format)',
    example: 'eip155:1',
  })
  @ApiParam({
    name: 'tokenId',
    description: 'Token identifier (CAIP-19 format)',
    example: 'slip44:60',
  })
  @ApiResponse({
    status: 200,
    description: 'Currency configuration updated successfully',
    type: CurrencyConfigResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Admin privileges required' })
  @ApiResponse({ status: 404, description: 'Currency not found' })
  async updateCurrencyConfig(
    @Session() session: UserSession,
    @Param('blockchainKey') blockchainKey: string,
    @Param('tokenId') tokenId: string,
    @Body(new ValidationPipe(validationOptions)) updateData: CurrencyConfigUpdateDto,
  ): Promise<CurrencyConfigResponseDto> {
    try {
      this.logger.log('Updating currency configuration', {
        adminId: session.user.id,
        blockchainKey,
        tokenId,
        updateData,
      });

      const currency = await this.adminCurrenciesService.updateCurrencyConfig(
        blockchainKey,
        tokenId,
        updateData,
      );

      if (!currency) {
        throw new NotFoundException('Currency not found');
      }

      return {
        success: true,
        data: currency,
      };
    } catch (error) {
      this.logger.error('Failed to update currency configuration', {
        error: error.message,
        blockchainKey,
        tokenId,
      });
      throw error;
    }
  }
}
