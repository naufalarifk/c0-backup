import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  BorrowerInfoDto,
  CurrencyDto,
  InvoiceDto,
  IsDecimalAmount,
  LiquidationMode,
  LoanApplicationStatus,
  PaginationMetaDto,
} from './common.dto';

export class LoanCalculationRequestDto {
  @ApiProperty({
    description: 'Blockchain key for collateral',
    example: 'eip155:1',
    maxLength: 64,
  })
  @IsString()
  collateralBlockchainKey: string;

  @ApiProperty({
    description: 'Token ID for collateral',
    example: 'slip44:60',
    maxLength: 64,
  })
  @IsString()
  collateralTokenId: string;

  @ApiProperty({
    description: 'Principal amount requested',
    example: '5000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  principalAmount: string;

  @ApiPropertyOptional({
    description: 'Term in months for the loan',
    example: 6,
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  termInMonths?: number;

  @ApiPropertyOptional({
    description: 'Loan term (alias for termInMonths)',
    example: 6,
    minimum: 1,
    maximum: 60,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(60)
  loanTerm?: number;
}

export class LoanCalculationDetailsDto {
  @ApiProperty({
    description: 'Base loan amount requested',
    example: '5000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  baseLoanAmount: string;

  @ApiProperty({
    description: 'Base collateral value without safety buffer',
    example: '7142.857142857142857142',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  baseCollateralValue: string;

  @ApiProperty({
    description: 'Collateral value including safety buffer',
    example: '8571.428571428571428571',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  withSafetyBuffer: string;

  @ApiProperty({
    description: 'Exchange rate at calculation time',
    example: '2100.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  currentExchangeRate: string;

  @ApiProperty({
    description: 'Source of exchange rate data',
    example: 'coinbase',
  })
  @IsString()
  rateSource: string;

  @ApiProperty({
    description: 'When the exchange rate was last updated',
    example: '2025-09-11T10:29:45Z',
  })
  @IsDateString()
  rateTimestamp: string;
}

export class LoanCalculationResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Calculation results',
  })
  data: {
    requiredCollateralAmount: string;
    collateralToLoanRatio: number;
    liquidationPrice: string;
    liquidationThreshold: number;
    estimatedInterestAmount: string;
    totalRepaymentAmount: string;
    fees: {
      liquidationFee: string;
      premiumRisk: string;
      provision: string;
    };
    ltv: number;
    marketRates: {
      collateralPrice: string;
      principalPrice: string;
    };
    // Legacy fields for backward compatibility
    exchangeRate: string;
    collateralCurrency: CurrencyDto;
    principalCurrency: CurrencyDto;
    maxLtvRatio: number;
    safetyBuffer: number;
    calculationDetails: LoanCalculationDetailsDto;
  };
}

export class CreateLoanApplicationDto {
  @ApiProperty({
    description: 'Blockchain key for collateral',
    example: 'eip155:1',
    maxLength: 64,
  })
  @IsString()
  collateralBlockchainKey: string;

  @ApiProperty({
    description: 'Token ID for collateral',
    example: 'slip44:60',
    maxLength: 64,
  })
  @IsString()
  collateralTokenId: string;

  @ApiProperty({
    description: 'Principal amount requested',
    example: '5000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  principalAmount: string;

  @ApiProperty({
    description: 'Maximum acceptable interest rate',
    example: 15,
    minimum: 0.1,
    maximum: 50,
  })
  @IsNumber()
  maxInterestRate: number;

  @ApiProperty({
    description: 'Loan term in months',
    example: 6,
    enum: [1, 3, 6, 12],
  })
  @IsNumber()
  @IsIn([1, 3, 6, 12])
  termMonths: number;

  @ApiProperty({
    description: 'Liquidation mode preference',
    enum: LiquidationMode,
    example: LiquidationMode.FULL,
  })
  @IsEnum(LiquidationMode)
  liquidationMode: LiquidationMode;

  @ApiProperty({
    description: 'Minimum acceptable LTV ratio',
    example: 0.5,
    minimum: 0,
    maximum: 1,
  })
  @IsNumber()
  @Min(0)
  @Max(1)
  minLtvRatio: number;
}

export class UpdateLoanApplicationDto {
  @ApiProperty({
    description: 'Action to perform on loan application',
    enum: ['Cancel'],
    example: 'Cancel',
  })
  @IsString()
  action: string;
}

export class LoanApplicationResponseDto {
  @ApiProperty({
    description: 'Loan application identifier',
    example: 'app_78901',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Borrower user identifier',
    example: 'user_12345',
  })
  @IsString()
  borrowerId: string;

  @ApiPropertyOptional({
    description: 'Borrower information',
    type: BorrowerInfoDto,
  })
  @IsOptional()
  @Type(() => BorrowerInfoDto)
  borrower?: BorrowerInfoDto;

  @ApiProperty({
    description: 'Collateral currency details',
    type: CurrencyDto,
  })
  @Type(() => CurrencyDto)
  collateralCurrency: CurrencyDto;

  @ApiPropertyOptional({
    description: 'Principal currency details',
    type: CurrencyDto,
  })
  @IsOptional()
  @Type(() => CurrencyDto)
  principalCurrency?: CurrencyDto;

  @ApiPropertyOptional({
    description: 'Maximum acceptable interest rate',
    example: 15.0,
  })
  @IsOptional()
  @IsNumber()
  maxInterestRate?: number;

  @ApiPropertyOptional({
    description: 'Loan term in months',
    example: 6,
    enum: [1, 3, 6, 12],
  })
  @IsOptional()
  @IsNumber()
  termMonths?: number;

  @ApiPropertyOptional({
    description: 'Liquidation mode preference',
    enum: LiquidationMode,
    example: LiquidationMode.FULL,
  })
  @IsOptional()
  @IsEnum(LiquidationMode)
  liquidationMode?: LiquidationMode;

  @ApiProperty({
    description: 'Principal amount requested',
    example: '5000.000000000000000000',
  })
  @IsString()
  @IsDecimalAmount()
  principalAmount: string;

  @ApiProperty({
    description: 'Current application status (derived from time-based fields and business logic)',
    enum: LoanApplicationStatus,
    example: LoanApplicationStatus.PUBLISHED,
  })
  @IsEnum(LoanApplicationStatus)
  status: LoanApplicationStatus;

  @ApiProperty({
    description: 'Creation date',
    example: '2025-09-11T10:30:00Z',
  })
  @IsDateString()
  createdDate: string;

  @ApiPropertyOptional({
    description: 'Publication date',
    example: '2025-09-11T10:45:00Z',
  })
  @IsOptional()
  @IsDateString()
  publishedDate?: string;

  @ApiPropertyOptional({
    description: 'Expiry date',
    example: '2025-09-18T10:45:00Z',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiProperty({
    description: 'Collateral deposit invoice details',
    type: InvoiceDto,
  })
  @Type(() => InvoiceDto)
  collateralInvoice: InvoiceDto;

  @ApiPropertyOptional({
    description: 'Minimum acceptable LTV ratio',
    example: 0.5,
    minimum: 0,
    maximum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  minLtvRatio?: number;

  @ApiPropertyOptional({
    description: 'Matched loan offer identifier',
    example: 'offer_123',
  })
  @IsOptional()
  @IsString()
  matchedLoanOfferId?: string;

  @ApiPropertyOptional({
    description: 'Matched LTV ratio',
    example: 0.6,
  })
  @IsOptional()
  @IsNumber()
  matchedLtvRatio?: number;
}

export class LoanApplicationListResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data',
  })
  data: {
    applications: LoanApplicationResponseDto[];
    pagination: PaginationMetaDto;
  };
}
