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
    description: 'Maximum acceptable interest rate as decimal (e.g., 0.15 = 15%)',
    example: 0.15,
    minimum: 0.001,
    maximum: 0.5,
  })
  @IsNumber()
  @Min(0.001)
  @Max(0.5)
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

  @ApiPropertyOptional({
    description: 'Optional creation date for the loan application (validated in production)',
    example: '2025-09-11T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  creationDate?: string;
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

// Detailed view DTOs
export class AmountWithCurrencyDto {
  @ApiProperty({
    description: 'Amount value',
    example: '1000.000000000000000000',
  })
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'Currency symbol',
    example: 'USDT',
  })
  @IsString()
  currency: string;
}

export class LoanBreakdownDto {
  @ApiProperty({
    description: 'Principal amount',
    type: AmountWithCurrencyDto,
  })
  @Type(() => AmountWithCurrencyDto)
  principal: AmountWithCurrencyDto;

  @ApiProperty({
    description: 'Interest amount with rate',
  })
  interest: AmountWithCurrencyDto & { rate: number };

  @ApiProperty({
    description: 'Provisions amount with rate',
  })
  provisions: AmountWithCurrencyDto & { rate: number };

  @ApiProperty({
    description: 'Total repayment amount',
    type: AmountWithCurrencyDto,
  })
  @Type(() => AmountWithCurrencyDto)
  totalRepayment: AmountWithCurrencyDto;
}

export class LoanTermsDto {
  @ApiProperty({
    description: 'Loan duration',
    example: '3 Months',
  })
  @IsString()
  duration: string;

  @ApiProperty({
    description: 'Payment type',
    example: 'Full Payment',
  })
  @IsString()
  paymentType: string;
}

export class CollateralDetailDto {
  @ApiProperty({
    description: 'Selected asset symbol',
    example: 'MCK',
  })
  @IsString()
  selectedAsset: string;

  @ApiProperty({
    description: 'Required collateral amount',
    type: AmountWithCurrencyDto,
  })
  @Type(() => AmountWithCurrencyDto)
  requiredAmount: AmountWithCurrencyDto;

  @ApiProperty({
    description: 'Current collateral value',
    type: AmountWithCurrencyDto,
  })
  @Type(() => AmountWithCurrencyDto)
  currentValue: AmountWithCurrencyDto;

  @ApiProperty({
    description: 'Current price per unit',
    type: AmountWithCurrencyDto,
  })
  @Type(() => AmountWithCurrencyDto)
  currentPrice: AmountWithCurrencyDto;

  @ApiProperty({
    description: 'Loan-to-Value ratio',
    example: 60,
  })
  @IsNumber()
  ltv: number;

  @ApiProperty({
    description: 'Liquidation trigger description',
    example: 'LTV exceeds 60%',
  })
  @IsString()
  liquidationTrigger: string;
}

export class RiskAssessmentDto {
  @ApiProperty({
    description: 'Risk level',
    example: 'Medium',
  })
  @IsString()
  riskLevel: string;

  @ApiProperty({
    description: 'Margin call threshold',
    example: 'LTV > 55%',
  })
  @IsString()
  marginCall: string;

  @ApiProperty({
    description: 'Liquidation threshold',
    example: 'LTV > 60%',
  })
  @IsString()
  liquidation: string;
}

export class PaymentMethodDto {
  @ApiProperty({
    description: 'Payment method identifier',
    example: 'crypto-transfer',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Payment method name',
    example: 'Crypto Transfer',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Payment method description',
    example: 'Transfer cryptocurrency directly',
  })
  @IsString()
  description: string;

  @ApiProperty({
    description: 'Icon identifier',
    example: 'crypto-icon',
  })
  @IsString()
  icon: string;

  @ApiProperty({
    description: 'Is this the recommended method',
    example: true,
  })
  @Type(() => Boolean)
  isRecommended: boolean;
}

export class LiquidationExecutionDto {
  @ApiProperty({
    description: 'Liquidation execution identifier',
    example: 'liq_123',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Execution date',
    example: '2025-10-10T10:30:00Z',
  })
  @IsDateString()
  executedDate: string;

  @ApiProperty({
    description: 'Trigger price',
    type: AmountWithCurrencyDto,
  })
  @Type(() => AmountWithCurrencyDto)
  triggerPrice: AmountWithCurrencyDto;

  @ApiProperty({
    description: 'Liquidated amount',
    type: AmountWithCurrencyDto,
  })
  @Type(() => AmountWithCurrencyDto)
  liquidatedAmount: AmountWithCurrencyDto;

  @ApiProperty({
    description: 'Liquidation reason',
    example: 'LTV exceeded threshold',
  })
  @IsString()
  reason: string;

  @ApiProperty({
    description: 'Execution status',
    enum: ['Executed', 'Pending', 'Failed'],
    example: 'Executed',
  })
  @IsString()
  status: string;
}

export class LoanApplicationDetailResponseDto {
  @ApiProperty({
    description: 'Loan application identifier',
    example: 'app_78901',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Application number for display',
    example: 'LA-2025-001',
  })
  @IsString()
  applicationNumber: string;

  @ApiProperty({
    description: 'Application status',
    enum: LoanApplicationStatus,
    example: LoanApplicationStatus.PUBLISHED,
  })
  @IsEnum(LoanApplicationStatus)
  status: LoanApplicationStatus;

  // Backward compatibility fields
  @ApiPropertyOptional({
    description: 'Borrower user identifier',
    example: 'user_12345',
  })
  @IsOptional()
  @IsString()
  borrowerId?: string;

  @ApiPropertyOptional({
    description: 'Borrower information',
    type: BorrowerInfoDto,
  })
  @IsOptional()
  @Type(() => BorrowerInfoDto)
  borrower?: BorrowerInfoDto;

  @ApiPropertyOptional({
    description: 'Collateral currency details',
    type: CurrencyDto,
  })
  @IsOptional()
  @Type(() => CurrencyDto)
  collateralCurrency?: CurrencyDto;

  @ApiPropertyOptional({
    description: 'Principal currency details',
    type: CurrencyDto,
  })
  @IsOptional()
  @Type(() => CurrencyDto)
  principalCurrency?: CurrencyDto;

  @ApiPropertyOptional({
    description: 'Principal amount (raw value for backward compatibility)',
    example: '5000.000000000000000000',
  })
  @IsOptional()
  @IsString()
  principalAmount?: string;

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
    description: 'Minimum acceptable LTV ratio',
    example: 0.5,
  })
  @IsOptional()
  @IsNumber()
  minLtvRatio?: number;

  @ApiPropertyOptional({
    description: 'Expiry date',
    example: '2025-09-18T10:45:00Z',
  })
  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @ApiPropertyOptional({
    description: 'Publication date',
    example: '2025-09-11T10:45:00Z',
  })
  @IsOptional()
  @IsDateString()
  publishedDate?: string;

  @ApiPropertyOptional({
    description: 'Creation date',
    example: '2025-09-11T10:30:00Z',
  })
  @IsOptional()
  @IsDateString()
  createdDate?: string;

  @ApiPropertyOptional({
    description: 'Collateral deposit invoice details',
    type: InvoiceDto,
  })
  @IsOptional()
  @Type(() => InvoiceDto)
  collateralInvoice?: InvoiceDto;

  @ApiPropertyOptional({
    description: 'Maximum loan amount',
    example: '10000.000000000000000000',
  })
  @IsOptional()
  @IsString()
  maxLoanAmount?: string;

  @ApiPropertyOptional({
    description: 'Minimum loan amount',
    example: '100.000000000000000000',
  })
  @IsOptional()
  @IsString()
  minLoanAmount?: string;

  @ApiProperty({
    description: 'Application submission date',
    example: '2025-10-10T10:30:00Z',
  })
  @IsDateString()
  appliedDate: string;

  @ApiProperty({
    description: 'Due date for repayment',
    example: '2025-11-10T10:30:00Z',
  })
  @IsDateString()
  dueDate: string;

  @ApiProperty({
    description: 'Loan amount details',
    type: AmountWithCurrencyDto,
  })
  @Type(() => AmountWithCurrencyDto)
  loanAmount: AmountWithCurrencyDto;

  @ApiProperty({
    description: 'Loan breakdown with interest and fees',
    type: LoanBreakdownDto,
  })
  @Type(() => LoanBreakdownDto)
  loanBreakdown: LoanBreakdownDto;

  @ApiProperty({
    description: 'Loan terms',
    type: LoanTermsDto,
  })
  @Type(() => LoanTermsDto)
  terms: LoanTermsDto;

  @ApiProperty({
    description: 'Collateral details',
    type: CollateralDetailDto,
  })
  @Type(() => CollateralDetailDto)
  collateral: CollateralDetailDto;

  @ApiProperty({
    description: 'Risk assessment',
    type: RiskAssessmentDto,
  })
  @Type(() => RiskAssessmentDto)
  riskAssessment: RiskAssessmentDto;

  @ApiProperty({
    description: 'Available payment methods',
    type: [PaymentMethodDto],
  })
  @Type(() => PaymentMethodDto)
  paymentMethods: PaymentMethodDto[];

  @ApiPropertyOptional({
    description: 'Liquidation executions (if any)',
    type: [LiquidationExecutionDto],
  })
  @IsOptional()
  @Type(() => LiquidationExecutionDto)
  liquidationExecutions?: LiquidationExecutionDto[];

  @ApiProperty({
    description: 'Liquidation mode',
    enum: LiquidationMode,
    example: LiquidationMode.PARTIAL,
  })
  @IsEnum(LiquidationMode)
  liquidationMode: LiquidationMode;

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
