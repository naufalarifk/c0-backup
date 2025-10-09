import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Max, Min } from 'class-validator';

export class CurrencyConfigDto {
  @ApiProperty({
    description: 'Blockchain identifier (CAIP-2 format)',
    example: 'eip155:1',
  })
  blockchainKey: string;

  @ApiProperty({
    description: 'Token identifier (CAIP-19 format)',
    example: 'slip44:60',
  })
  tokenId: string;

  @ApiProperty({
    description: 'Human-readable currency name',
    example: 'Ethereum',
  })
  name: string;

  @ApiProperty({
    description: 'Currency symbol (e.g., BTC, ETH)',
    example: 'ETH',
  })
  symbol: string;

  @ApiProperty({
    description: 'Number of decimal places for the currency',
    example: 18,
  })
  decimals: number;

  @ApiProperty({
    description: 'URL to currency logo/icon',
    example: 'https://assets.cryptogadai.com/currencies/eth.png',
  })
  image: string;

  @ApiProperty({
    description: 'Fee rate for withdrawals (decimal, e.g. 0.001 = 0.1%)',
    example: 0.001,
  })
  withdrawalFeeRate: number;

  @ApiProperty({
    description: 'Minimum withdrawal amount (in smallest currency unit)',
    example: '1000000000000000000',
  })
  minWithdrawalAmount: string;

  @ApiProperty({
    description: 'Maximum withdrawal amount (in smallest currency unit)',
    example: '10000000000000000000000',
  })
  maxWithdrawalAmount: string;

  @ApiProperty({
    description: 'Maximum daily withdrawal amount (in smallest currency unit)',
    example: '50000000000000000000000',
  })
  maxDailyWithdrawalAmount: string;

  @ApiProperty({
    description: 'Minimum loan principal amount (in smallest currency unit)',
    example: '10000000000000000000',
  })
  minLoanPrincipalAmount: string;

  @ApiProperty({
    description: 'Maximum loan principal amount (in smallest currency unit)',
    example: '100000000000000000000000',
  })
  maxLoanPrincipalAmount: string;

  @ApiProperty({
    description: 'Maximum loan-to-value ratio (decimal, e.g. 0.75 = 75%)',
    example: 0.75,
  })
  maxLtv: number;

  @ApiProperty({
    description: 'LTV warning threshold (decimal, e.g. 0.70 = 70%)',
    example: 0.65,
  })
  ltvWarningThreshold: number;

  @ApiProperty({
    description: 'LTV critical threshold (decimal, e.g. 0.80 = 80%)',
    example: 0.72,
  })
  ltvCriticalThreshold: number;

  @ApiProperty({
    description: 'LTV liquidation threshold (decimal, e.g. 0.85 = 85%)',
    example: 0.78,
  })
  ltvLiquidationThreshold: number;
}

export class CurrencyListResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data containing currencies list',
    type: 'object',
    properties: {
      currencies: {
        type: 'array',
        items: { $ref: '#/components/schemas/CurrencyConfigDto' },
      },
    },
  })
  data: {
    currencies: CurrencyConfigDto[];
  };

  @ApiProperty({
    description: 'Pagination metadata',
    type: 'object',
    properties: {
      page: { type: 'number', example: 1 },
      limit: { type: 'number', example: 20 },
      total: { type: 'number', example: 50 },
      totalPages: { type: 'number', example: 3 },
      hasNext: { type: 'boolean', example: true },
      hasPrev: { type: 'boolean', example: false },
    },
  })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class CurrencyConfigUpdateDto {
  @ApiProperty({
    description: 'Fee rate for withdrawals (decimal, e.g. 0.001 = 0.1%)',
    minimum: 0,
    maximum: 1,
    example: 0.001,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  withdrawalFeeRate: number;

  @ApiProperty({
    description: 'Minimum withdrawal amount (in smallest currency unit)',
    example: '1000000000000000000',
  })
  @IsString()
  minWithdrawalAmount: string;

  @ApiProperty({
    description: 'Maximum withdrawal amount (in smallest currency unit)',
    example: '10000000000000000000000',
  })
  @IsString()
  maxWithdrawalAmount: string;

  @ApiProperty({
    description: 'Maximum daily withdrawal amount (in smallest currency unit)',
    example: '50000000000000000000000',
  })
  @IsString()
  maxDailyWithdrawalAmount: string;

  @ApiProperty({
    description: 'Minimum loan principal amount (in smallest currency unit)',
    example: '10000000000000000000',
  })
  @IsString()
  minLoanPrincipalAmount: string;

  @ApiProperty({
    description: 'Maximum loan principal amount (in smallest currency unit)',
    example: '100000000000000000000000',
  })
  @IsString()
  maxLoanPrincipalAmount: string;

  @ApiProperty({
    description: 'Maximum loan-to-value ratio (decimal, e.g. 0.75 = 75%)',
    minimum: 0,
    maximum: 1,
    example: 0.75,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  maxLtv: number;

  @ApiProperty({
    description: 'LTV warning threshold (decimal, e.g. 0.70 = 70%)',
    minimum: 0,
    maximum: 1,
    example: 0.65,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  ltvWarningThreshold: number;

  @ApiProperty({
    description: 'LTV critical threshold (decimal, e.g. 0.80 = 80%)',
    minimum: 0,
    maximum: 1,
    example: 0.72,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  ltvCriticalThreshold: number;

  @ApiProperty({
    description: 'LTV liquidation threshold (decimal, e.g. 0.85 = 85%)',
    minimum: 0,
    maximum: 1,
    example: 0.78,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  ltvLiquidationThreshold: number;
}

export class CurrencyConfigResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Updated currency configuration data',
    type: CurrencyConfigDto,
  })
  data: CurrencyConfigDto;
}
