import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUrl, Max, Min } from 'class-validator';

export class BlockchainDetailDto {
  @ApiProperty({
    description: 'CAIP-2 compliant blockchain identifier',
    example: 'eip155:1',
    maxLength: 64,
  })
  @IsString()
  key: string;

  @ApiProperty({
    description: 'Human-readable blockchain network name',
    example: 'Ethereum Mainnet',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Blockchain short name/symbol',
    example: 'ETH',
  })
  @IsString()
  shortName: string;

  @ApiProperty({
    description: 'URL to blockchain logo image',
    example: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  })
  @IsUrl()
  image: string;
}

export class BlockchainsResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data containing blockchains list',
    type: 'object',
    properties: {
      blockchains: {
        type: 'array',
        items: { $ref: '#/components/schemas/BlockchainDetailDto' },
      },
    },
  })
  data: {
    blockchains: BlockchainDetailDto[];
  };
}

export class CurrencyDetailDto {
  @ApiProperty({
    description: 'CAIP-2 compliant blockchain identifier',
    example: 'eip155:1',
    maxLength: 64,
  })
  @IsString()
  blockchainKey: string;

  @ApiProperty({
    description: 'Token identifier within the blockchain (CAIP-19 format)',
    example: 'slip44:60',
    maxLength: 64,
  })
  @IsString()
  tokenId: string;

  @ApiProperty({
    description: 'Human-readable currency name',
    example: 'Ethereum',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Currency symbol/ticker',
    example: 'ETH',
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: 'Number of decimal places for precision',
    example: 18,
    minimum: 0,
    maximum: 18,
  })
  @IsNumber()
  @Min(0)
  @Max(18)
  decimals: number;

  @ApiProperty({
    description: 'URL to currency logo image',
    example: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
  })
  @IsUrl()
  logoUrl: string;

  @ApiProperty({
    description: 'Whether this currency can be used as collateral',
    example: true,
  })
  isCollateralCurrency: boolean;

  @ApiProperty({
    description: 'Whether this currency can be used for loans',
    example: false,
  })
  isLoanCurrency: boolean;

  @ApiProperty({
    description: 'Maximum Loan-to-Value ratio for collateral (percentage)',
    example: 70.0,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  maxLtv: number;

  @ApiProperty({
    description: 'LTV threshold that triggers warning notifications',
    example: 56.0,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  ltvWarningThreshold: number;

  @ApiProperty({
    description: 'LTV threshold that triggers critical alerts',
    example: 66.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  ltvCriticalThreshold: number;

  @ApiProperty({
    description: 'LTV threshold that triggers automatic liquidation',
    example: 70.0,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  ltvLiquidationThreshold: number;

  @ApiProperty({
    description: 'Minimum loan amount in smallest unit (wei/satoshi equivalent)',
    example: '1000000000000000000000',
  })
  @IsString()
  minLoanPrincipalAmount: string;

  @ApiProperty({
    description: 'Maximum loan amount in smallest unit (0 means no limit)',
    example: '0',
  })
  @IsString()
  maxLoanPrincipalAmount: string;

  @ApiProperty({
    description: 'Minimum withdrawal amount in smallest unit',
    example: '100000000000000000000',
  })
  @IsString()
  minWithdrawalAmount: string;

  @ApiProperty({
    description: 'Maximum withdrawal amount in smallest unit (0 means no limit)',
    example: '0',
  })
  @IsString()
  maxWithdrawalAmount: string;

  @ApiProperty({
    description: 'Maximum daily withdrawal amount in smallest unit (0 means no limit)',
    example: '0',
  })
  @IsString()
  maxDailyWithdrawalAmount: string;

  @ApiProperty({
    description: 'Withdrawal fee rate (decimal, e.g., 0.001 = 0.1%)',
    example: 0.0,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  withdrawalFeeRate: number;

  @ApiProperty({
    description: 'Associated blockchain information',
    type: BlockchainDetailDto,
  })
  blockchain: BlockchainDetailDto;
}

export class CurrenciesResponseDto {
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
        items: { $ref: '#/components/schemas/CurrencyDetailDto' },
      },
    },
  })
  data: {
    currencies: CurrencyDetailDto[];
  };
}

export class CurrencyDto {
  @ApiProperty({
    description: 'CAIP-2 compliant blockchain identifier',
    example: 'eip155:1',
    maxLength: 64,
  })
  @IsString()
  blockchainKey: string;

  @ApiProperty({
    description: 'Token identifier within the blockchain',
    example: 'slip44:60',
    maxLength: 64,
  })
  @IsString()
  tokenId: string;

  @ApiProperty({
    description: 'Human-readable currency name',
    example: 'Ethereum',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Currency symbol/ticker',
    example: 'ETH',
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: 'Number of decimal places for precision',
    example: 18,
    minimum: 0,
    maximum: 18,
  })
  @IsNumber()
  @Min(0)
  @Max(18)
  decimals: number;

  @ApiProperty({
    description: 'URL to currency logo image',
    example: 'https://assets.cryptogadai.com/currencies/eth.png',
  })
  @IsUrl()
  logoUrl: string;
}

export class ExchangeRateDto {
  @ApiProperty({
    description: 'Exchange rate record ID',
    example: 404,
  })
  @IsNumber()
  id: number;

  @ApiProperty({
    description: 'Base asset information',
    type: CurrencyDto,
  })
  baseAsset: CurrencyDto;

  @ApiProperty({
    description: 'Quote asset information',
    type: CurrencyDto,
  })
  quoteAsset: CurrencyDto;

  @ApiProperty({
    description: 'Bid price (decimal string)',
    example: '2450.750000000000000000',
  })
  @IsString()
  bidPrice: string;

  @ApiProperty({
    description: 'Ask price (decimal string)',
    example: '2451.250000000000000000',
  })
  @IsString()
  askPrice: string;

  @ApiProperty({
    description: 'Mid price ((bid + ask) / 2)',
    example: '2451.000000000000000000',
  })
  @IsString()
  midPrice: string;

  @ApiProperty({
    description: 'Price data source',
    example: 'coinbase',
  })
  @IsString()
  source: string;

  @ApiProperty({
    description: 'Timestamp from price source',
    example: '2025-08-11T15:29:45Z',
  })
  @IsString()
  sourceDate: string;

  @ApiProperty({
    description: 'Timestamp when price was retrieved',
    example: '2025-08-11T15:30:00Z',
  })
  @IsString()
  retrievalDate: string;
}

export class ExchangeRatesResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data containing exchange rates and last updated timestamp',
    type: 'object',
    properties: {
      exchangeRates: {
        type: 'array',
        items: { $ref: '#/components/schemas/ExchangeRateDto' },
      },
      lastUpdated: {
        type: 'string',
        format: 'date-time',
        example: '2025-08-11T15:30:00Z',
      },
    },
  })
  data: {
    exchangeRates: ExchangeRateDto[];
    lastUpdated: string;
  };
}

// Query parameter DTOs
export class GetCurrenciesQueryDto {
  @ApiProperty({
    description: 'Filter by currency usage type',
    enum: ['collateral', 'loan', 'all'],
    required: false,
    example: 'all',
  })
  @IsOptional()
  @IsString()
  type?: 'collateral' | 'loan' | 'all';

  @ApiProperty({
    description: 'Filter by blockchain key (CAIP-2 format)',
    example: 'eip155:1',
    required: false,
  })
  @IsOptional()
  @IsString()
  blockchainKey?: string;

  @ApiProperty({
    description: 'Filter currencies with minimum LTV ratio',
    minimum: 0,
    maximum: 100,
    example: 50.0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  minLtv?: number;

  @ApiProperty({
    description: 'Filter currencies with maximum LTV ratio',
    minimum: 0,
    maximum: 100,
    example: 70.0,
    required: false,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  maxLtv?: number;
}

export class GetExchangeRatesQueryDto {
  @ApiProperty({
    description: 'Filter by base currency blockchain key (CAIP-2 format)',
    example: 'eip155:1',
    required: false,
  })
  @IsOptional()
  @IsString()
  baseCurrencyBlockchainKey?: string;

  @ApiProperty({
    description: 'Filter by base currency token ID (CAIP-19 format)',
    example: 'slip44:60',
    required: false,
  })
  @IsOptional()
  @IsString()
  baseCurrencyTokenId?: string;

  @ApiProperty({
    description: 'Filter by quote currency blockchain key (CAIP-2 format)',
    example: 'eip155:56',
    required: false,
  })
  @IsOptional()
  @IsString()
  quoteCurrencyBlockchainKey?: string;

  @ApiProperty({
    description: 'Filter by quote currency token ID (CAIP-19 format)',
    example: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    required: false,
  })
  @IsOptional()
  @IsString()
  quoteCurrencyTokenId?: string;

  @ApiProperty({
    description: 'Filter by price feed source',
    example: 'binance',
    required: false,
  })
  @IsOptional()
  @IsString()
  source?: string;
}
