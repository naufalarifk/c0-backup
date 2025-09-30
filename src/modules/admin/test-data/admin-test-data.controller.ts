import { Body, Controller, Logger, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { IsDateString, IsNumber, IsString } from 'class-validator';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';

class SeedExchangeRateDto {
  @IsString()
  blockchainKey: string;

  @IsString()
  baseCurrencyTokenId: string;

  @IsString()
  quoteCurrencyTokenId: string;

  @IsString()
  source: string;

  @IsNumber()
  bidPrice: number;

  @IsNumber()
  askPrice: number;

  @IsDateString()
  sourceDate: string;
}

@ApiTags('admin')
@Controller('admin')
export class AdminTestDataController {
  private readonly logger = new Logger(AdminTestDataController.name);

  constructor(private readonly repository: CryptogadaiRepository) {}

  @Post('seed-exchange-rate')
  @ApiOperation({
    summary: 'Seed exchange rate data for testing',
    description: 'This endpoint is only available in test environments to seed exchange rate data',
  })
  async seedExchangeRate(@Body() dto: SeedExchangeRateDto) {
    // Only allow this in test environment
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test data seeding not allowed in production');
    }

    this.logger.log(
      `Seeding exchange rate for ${dto.baseCurrencyTokenId}/${dto.quoteCurrencyTokenId}`,
    );

    try {
      const result = await this.repository.testSetupPriceFeeds({
        blockchainKey: dto.blockchainKey,
        baseCurrencyTokenId: dto.baseCurrencyTokenId,
        quoteCurrencyTokenId: dto.quoteCurrencyTokenId,
        source: dto.source,
        bidPrice: dto.bidPrice,
        askPrice: dto.askPrice,
        sourceDate: new Date(dto.sourceDate),
      });

      return {
        success: true,
        data: result,
        message: 'Exchange rate seeded successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to seed exchange rate: ${error.message}`);
      throw error;
    }
  }
}
