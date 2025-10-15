import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

import {
  CurrencyDto,
  InvoiceDto,
  IsDecimalAmount,
  LoanStatus,
  PaginationMetaDto,
  UserRole,
} from './common.dto';

export class LoanBreakdownDto {
  @ApiProperty({
    description: 'Original loan principal',
    example: '10000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  principalAmount: string;

  @ApiProperty({
    description: 'Total interest amount',
    example: '600.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  interestAmount: string;

  @ApiProperty({
    description: 'Origination fee (3% of principal)',
    example: '300.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  originationFeeAmount: string;

  @ApiProperty({
    description: 'Total amount to repay',
    example: '10900.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  totalRepaymentAmount: string;
}

export class LoanResponseDto {
  @ApiProperty({
    description: 'Unique loan identifier',
    example: 'loan_12345',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Borrower user identifier',
    example: 'user_12345',
  })
  @IsString()
  borrowerId: string;

  @ApiProperty({
    description: 'Lender user identifier',
    example: 'user_67890',
  })
  @IsString()
  lenderId: string;

  @ApiProperty({
    description: 'Loan offer identifier',
    example: 'loan_offer_12345',
  })
  @IsString()
  loanOfferId: string;

  @ApiProperty({
    description: 'Principal currency details',
    type: CurrencyDto,
  })
  @Type(() => CurrencyDto)
  principalCurrency: CurrencyDto;

  @ApiProperty({
    description: 'Loan principal amount',
    example: '10000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  principalAmount: string;

  @ApiProperty({
    description: 'Collateral currency details',
    type: CurrencyDto,
  })
  @Type(() => CurrencyDto)
  collateralCurrency: CurrencyDto;

  @ApiProperty({
    description: 'Collateral amount deposited',
    example: '5.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  collateralAmount: string;

  @ApiProperty({
    description: 'Annual interest rate percentage',
    example: 12.5,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  interestRate: number;

  @ApiProperty({
    description: 'Loan term in months',
    example: 6,
    minimum: 1,
    maximum: 12,
  })
  @IsNumber()
  termMonths: number;

  @ApiProperty({
    description: 'Current loan-to-value ratio percentage',
    example: 87.2,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  currentLtv: number;

  @ApiProperty({
    description: 'Maximum allowed LTV ratio percentage',
    example: 70.0,
    minimum: 0,
    maximum: 100,
  })
  @IsNumber()
  maxLtvRatio: number;

  @ApiProperty({
    description: 'Current loan status (derived from time-based fields and business logic)',
    enum: LoanStatus,
    example: LoanStatus.ACTIVE,
  })
  @IsEnum(LoanStatus)
  status: LoanStatus;

  @ApiProperty({
    description: 'When the loan was originated',
    example: '2025-09-11T10:30:00Z',
  })
  @IsDateString()
  originationDate: string;

  @ApiPropertyOptional({
    description: 'When funds were disbursed to borrower',
    example: '2025-09-11T11:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  disbursementDate?: string;

  @ApiPropertyOptional({
    description: 'When the loan is due for repayment',
    example: '2026-03-11T11:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  maturityDate?: string;

  @ApiPropertyOptional({
    description: 'When the loan was fully repaid',
    example: null,
  })
  @IsOptional()
  @IsDateString()
  repaidDate?: string;

  @ApiPropertyOptional({
    description: 'When the collateral was liquidated',
    example: null,
  })
  @IsOptional()
  @IsDateString()
  liquidationDate?: string;

  @ApiProperty({
    description: 'Borrower number for display purposes',
    example: '1',
  })
  @IsString()
  borrowerNumber: string;

  @ApiPropertyOptional({
    description: 'Borrower name',
    example: 'John Doe',
  })
  @IsOptional()
  @IsString()
  borrowerName?: string;

  @ApiPropertyOptional({
    description: 'Borrower profile picture URL',
    example: 'https://example.com/profile.jpg',
  })
  @IsOptional()
  @IsString()
  profilePictureUrl?: string;

  @ApiPropertyOptional({
    description: 'Repayment invoice details',
    type: InvoiceDto,
  })
  @IsOptional()
  @Type(() => InvoiceDto)
  repaymentInvoice?: InvoiceDto;

  @ApiProperty({
    description: 'Detailed loan payment breakdown',
    type: LoanBreakdownDto,
  })
  @Type(() => LoanBreakdownDto)
  loanBreakdown: LoanBreakdownDto;
}

export class LoanListResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Response data',
  })
  data: {
    loans: LoanResponseDto[];
    pagination: PaginationMetaDto;
  };
}

export class LoanValuationResponseDto {
  @ApiProperty({
    description: 'Valuation identifier',
    example: 'val_12345',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Associated loan identifier',
    example: 'loan_12345',
  })
  @IsString()
  loanId: string;

  @ApiProperty({
    description: 'Valuation timestamp',
    example: '2025-09-11T15:30:00Z',
  })
  @IsDateString()
  valuationDate: string;

  @ApiProperty({
    description: 'LTV ratio at valuation time',
    example: 87.2,
  })
  @IsNumber()
  ltvRatio: number;

  @ApiProperty({
    description: 'Collateral value at valuation time',
    example: '11500.000000000000000000',
  })
  @IsString()
  @IsDecimalAmount()
  collateralValue: string;

  @ApiProperty({
    description: 'Exchange rate used for valuation',
    example: '2300.000000000000000000',
  })
  @IsString()
  @IsDecimalAmount()
  exchangeRate: string;
}

export class LoanValuationListResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Response data',
  })
  data: {
    valuations: LoanValuationResponseDto[];
    pagination: PaginationMetaDto;
  };
}

export class LoanAgreementSignatureDto {
  @ApiProperty({
    description: 'User ID who signed',
    example: 67890,
  })
  @IsNumber()
  userId: number;

  @ApiProperty({
    description: 'Role of the signer',
    enum: UserRole,
    example: UserRole.BORROWER,
  })
  @IsEnum(UserRole)
  userType: UserRole;

  @ApiProperty({
    description: 'When the document was signed',
    example: '2025-09-23T14:22:15Z',
  })
  @IsDateString()
  signedAt: string;
}

export class LoanAgreementResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Agreement document data',
  })
  data: {
    documentUrl?: string;
    signatureRequired: boolean;
    signedBy: LoanAgreementSignatureDto[];
    generationStatus: string; // 'ready', 'generating', 'pending', 'Failed', 'regenerating'
    requestId?: string;
  };
}
