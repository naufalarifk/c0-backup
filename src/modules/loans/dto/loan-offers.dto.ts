import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

import {
  CurrencyDto,
  InvoiceDto,
  IsDecimalAmount,
  LenderInfoDto,
  LoanOfferStatus,
  PaginationMetaDto,
} from './common.dto';

export class CreateLoanOfferDto {
  @ApiProperty({
    description: 'Blockchain key for principal currency',
    example: 'eip155:56',
    maxLength: 64,
  })
  @IsString()
  principalBlockchainKey: string;

  @ApiProperty({
    description: 'Token ID for principal currency',
    example: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    maxLength: 64,
  })
  @IsString()
  principalTokenId: string;

  @ApiProperty({
    description: 'Total loan offer amount (18 decimal precision)',
    example: '10000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  totalAmount: string;

  @ApiProperty({
    description: 'Annual interest rate as decimal (e.g., 0.125 = 12.5%)',
    example: 0.125,
    minimum: 0.001,
    maximum: 0.5,
  })
  @IsNumber()
  @Min(0.001)
  @Max(0.5)
  interestRate: number;

  @ApiProperty({
    description: 'Available term options in months',
    example: [3, 6],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  termOptions: number[];

  @ApiProperty({
    description: 'Minimum loan amount (18 decimal precision)',
    example: '1000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  minLoanAmount: string;

  @ApiProperty({
    description: 'Maximum loan amount (18 decimal precision)',
    example: '10000.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  maxLoanAmount: string;

  @ApiProperty({
    description: 'Expiration date for the offer',
    example: '2025-12-31T23:59:59Z',
  })
  @IsDateString()
  expirationDate: string;
}

export class UpdateLoanOfferDto {
  @ApiProperty({
    description: 'Action to perform on loan offer',
    enum: ['Close'],
    example: 'Close',
  })
  @IsString()
  action: string;

  @ApiPropertyOptional({
    description: 'Reason for closing the offer',
    example: 'No longer offering loans',
  })
  @IsOptional()
  @IsString()
  closureReason?: string;
}

export class LoanOfferResponseDto {
  @ApiProperty({
    description: 'Loan offer identifier',
    example: '12345',
  })
  @IsString()
  id: string;

  @ApiProperty({
    description: 'Lender user identifier',
    example: 'user_67890',
  })
  @IsString()
  lenderId: string;

  @ApiProperty({
    description: 'Lender information',
    type: LenderInfoDto,
  })
  @Type(() => LenderInfoDto)
  lender: LenderInfoDto;

  @ApiProperty({
    description: 'Principal currency details',
    type: CurrencyDto,
  })
  @Type(() => CurrencyDto)
  principalCurrency: CurrencyDto;

  @ApiProperty({
    description: 'Total offer amount',
    example: '10000.000000000000000000',
  })
  @IsString()
  @IsDecimalAmount()
  totalAmount: string;

  @ApiProperty({
    description: 'Available amount for lending',
    example: '10000.000000000000000000',
  })
  @IsString()
  @IsDecimalAmount()
  availableAmount: string;

  @ApiProperty({
    description: 'Amount already disbursed',
    example: '0.000000000000000000',
  })
  @IsString()
  @IsDecimalAmount()
  disbursedAmount: string;

  @ApiProperty({
    description: 'Annual interest rate',
    example: 12.5,
  })
  @IsNumber()
  interestRate: number;

  @ApiProperty({
    description: 'Available term options in months',
    example: [3, 6],
    type: [Number],
  })
  @IsArray()
  @IsNumber({}, { each: true })
  termOptions: number[];

  @ApiProperty({
    description: 'Current offer status (derived from time-based fields and business logic)',
    enum: LoanOfferStatus,
    example: LoanOfferStatus.PUBLISHED,
  })
  @IsEnum(LoanOfferStatus)
  status: LoanOfferStatus;

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

  @ApiProperty({
    description: 'Funding invoice details',
    type: InvoiceDto,
  })
  @Type(() => InvoiceDto)
  fundingInvoice: InvoiceDto;
}

export class LoanOfferListResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response data',
  })
  data: {
    offers: LoanOfferResponseDto[];
    pagination: PaginationMetaDto;
  };
}
