import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsDateString, IsOptional, IsString, Matches } from 'class-validator';

export class ManualExchangeRateFeedDto {
  @ApiProperty({
    description: 'Price feed ID for which to set the exchange rate',
    example: '1',
  })
  @IsString()
  priceFeedId: string;

  @ApiProperty({
    description: 'Bid price (decimal string, e.g., "0.000012345678")',
    example: '0.000012345678',
    pattern: '^[0-9]+(\\.[0-9]+)?$',
  })
  @IsString()
  @Matches(/^[0-9]+(\.[0-9]+)?$/, {
    message: 'bidPrice must be a valid decimal string',
  })
  bidPrice: string;

  @ApiProperty({
    description: 'Ask price (decimal string, e.g., "0.000012345679")',
    example: '0.000012345679',
    pattern: '^[0-9]+(\\.[0-9]+)?$',
  })
  @IsString()
  @Matches(/^[0-9]+(\.[0-9]+)?$/, {
    message: 'askPrice must be a valid decimal string',
  })
  askPrice: string;

  @ApiProperty({
    description: 'Source date of the exchange rate (ISO 8601 format)',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  sourceDate?: string;

  @ApiProperty({
    description: 'Retrieval date of the exchange rate (ISO 8601 format)',
    example: '2024-01-15T10:30:00Z',
    required: false,
  })
  @IsOptional()
  @IsDateString()
  retrievalDate?: string;
}

export class ExchangeRateFeedResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data containing the exchange rate feed result',
    type: 'object',
    properties: {
      message: {
        type: 'string',
        example: 'Exchange rate feed dispatched successfully',
      },
      priceFeedId: {
        type: 'string',
        example: '1',
      },
      blockchainKey: {
        type: 'string',
        example: 'eip155:1',
      },
      baseCurrencyTokenId: {
        type: 'string',
        example: 'slip44:60',
      },
      quoteCurrencyTokenId: {
        type: 'string',
        example: 'slip44:825',
      },
      bidPrice: {
        type: 'string',
        example: '0.000012345678',
      },
      askPrice: {
        type: 'string',
        example: '0.000012345679',
      },
      sourceDate: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00Z',
      },
      retrievalDate: {
        type: 'string',
        format: 'date-time',
        example: '2024-01-15T10:30:00Z',
      },
    },
  })
  data: {
    message: string;
    priceFeedId: string;
    blockchainKey: string;
    baseCurrencyTokenId: string;
    quoteCurrencyTokenId: string;
    bidPrice: string;
    askPrice: string;
    sourceDate: string;
    retrievalDate: string;
  };
}
