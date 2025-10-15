import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsBoolean, IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ExecuteSettlementDto {
  @ApiPropertyOptional({
    description:
      'Specific asset to settle (e.g., USDT, BTC). If not provided, all assets will be settled.',
    example: 'USDT',
  })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({
    description: 'Force settlement even if conditions are not met',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  forceRun?: boolean;
}

export class CalculateSettlementDto {
  @ApiProperty({
    description: 'Total balance in hot wallets',
    example: '1000.50',
  })
  @IsString()
  hotWalletTotal!: string;

  @ApiProperty({
    description: 'Current balance in Binance',
    example: '500.25',
  })
  @IsString()
  currentBinance!: string;

  @ApiProperty({
    description: 'Settlement ratio (percentage as decimal)',
    example: 0.5,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  ratio!: number;
}

export class GetSettlementHistoryDto {
  @ApiPropertyOptional({
    description: 'Maximum number of records to return',
    example: 10,
    default: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number;

  @ApiPropertyOptional({
    description: 'Number of records to skip',
    example: 0,
    default: 0,
    minimum: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offset?: number;

  @ApiPropertyOptional({
    description: 'Filter by specific asset',
    example: 'USDT',
  })
  @IsOptional()
  @IsString()
  asset?: string;

  @ApiPropertyOptional({
    description: 'Filter by start date (ISO 8601 format)',
    example: '2025-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Filter by end date (ISO 8601 format)',
    example: '2025-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
