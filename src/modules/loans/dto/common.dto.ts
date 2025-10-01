import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  Min,
} from 'class-validator';

export enum LoanOfferStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
  CLOSED = 'Closed',
}

export enum LoanApplicationStatus {
  DRAFT = 'Draft',
  PUBLISHED = 'Published',
  MATCHED = 'Matched',
  EXPIRED = 'Expired',
  CANCELLED = 'Cancelled',
  CLOSED = 'Closed',
}

export enum LoanStatus {
  ORIGINATED = 'Originated',
  DISBURSED = 'Disbursed',
  ACTIVE = 'Active',
  REPAID = 'Repaid',
  LIQUIDATED = 'Liquidated',
}

export enum LiquidationMode {
  PARTIAL = 'Partial',
  FULL = 'Full',
}

export enum UserRole {
  BORROWER = 'borrower',
  LENDER = 'lender',
}

export enum LenderType {
  INDIVIDUAL = 'Individual',
  INSTITUTION = 'Institution',
}

export enum LiquidationStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  FULFILLED = 'Fulfilled',
  FAILED = 'Failed',
}

export enum RepaymentStatus {
  PENDING = 'Pending',
  PROCESSING = 'Processing',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
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

export class LenderInfoDto {
  @ApiProperty({
    description: 'Lender user identifier',
    example: 'user_67890',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Type of lender',
    enum: LenderType,
    example: LenderType.INDIVIDUAL,
  })
  @IsEnum(LenderType)
  type: LenderType;

  @ApiProperty({
    description: 'Lender display name (user.name for Individual, business_name for Institution)',
    example: 'John Doe',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Business type (only for Institution lenders)',
    example: 'PT',
  })
  @IsOptional()
  @IsString()
  businessType?: string;

  @ApiPropertyOptional({
    description: 'Business description (only for Institution lenders)',
    example: 'PT. Financial Services Indonesia is a leading fintech company',
  })
  @IsOptional()
  @IsString()
  businessDescription?: string;

  @ApiPropertyOptional({
    description: 'URL to lender profile picture',
    example: 'https://assets.cryptogadai.com/profiles/user_67890.jpg',
  })
  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

  @ApiProperty({
    description: 'Whether the lender is verified',
    example: true,
  })
  @IsBoolean()
  verified: boolean;
}

export class BorrowerInfoDto {
  @ApiProperty({
    description: 'Borrower user identifier',
    example: 'user_12345',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Type of borrower',
    example: 'Individual',
  })
  @IsString()
  type: string;

  @ApiProperty({
    description: 'Borrower display name',
    example: 'Jane Smith',
  })
  @IsString()
  name: string;
}

export class InvoiceDto {
  @ApiProperty({
    description: 'Invoice identifier',
    example: 'inv_12345',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Invoice amount with decimal precision',
    example: '10000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @Matches(/^\d+\.\d{18}$/)
  amount: string;

  @ApiProperty({
    description: 'Invoice currency',
    type: CurrencyDto,
  })
  @Type(() => CurrencyDto)
  currency: CurrencyDto;

  @ApiProperty({
    description: 'Payment wallet address',
    example: '0x742d35Cc6634C0532925a3b8D...',
  })
  @IsString()
  walletAddress: string;

  @ApiProperty({
    description: 'Invoice expiry date',
    example: '2025-09-11T10:45:00Z',
  })
  @IsDateString()
  expiryDate: string;

  @ApiPropertyOptional({
    description: 'Date when invoice was paid',
    example: '2025-09-11T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @ApiPropertyOptional({
    description: 'Date when invoice expired',
    example: null,
  })
  @IsOptional()
  @IsDateString()
  expiredDate?: string;
}

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Current page number (1-based)',
    example: 1,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsNumber()
  @Min(1)
  @Max(100)
  limit: number;

  @ApiProperty({
    description: 'Total number of items across all pages',
    example: 150,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalPages: number;

  @ApiProperty({
    description: 'Whether there are more pages after current',
    example: true,
  })
  @IsBoolean()
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there are pages before current',
    example: false,
  })
  @IsBoolean()
  hasPrev: boolean;
}

export class ErrorResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: false,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Error details',
    example: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: {},
    },
  })
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };

  @ApiProperty({
    description: 'Error timestamp',
    example: '2025-08-13T15:30:00Z',
  })
  @IsDateString()
  timestamp: string;

  @ApiProperty({
    description: 'Request ID for tracking',
    example: 'req_abc123',
  })
  @IsString()
  requestId: string;
}

// Decimal amount validation pattern
export const DECIMAL_AMOUNT_PATTERN = /^\d+\.\d{18}$/;

// Common validation decorators
export const IsDecimalAmount = () => Matches(DECIMAL_AMOUNT_PATTERN);
