import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUrl,
  Max,
  Min,
} from 'class-validator';

export enum AccountMutationType {
  INVOICE_RECEIVED = 'invoiceReceived',
  LOAN_COLLATERAL_DEPOSIT = 'loanCollateralDeposit',
  LOAN_APPLICATION_COLLATERAL_ESCROWED = 'loanApplicationCollateralEscrowed',
  LOAN_PRINCIPAL_DISBURSEMENT = 'loanPrincipalDisbursement',
  LOAN_DISBURSEMENT_RECEIVED = 'loanDisbursementReceived',
  LOAN_PRINCIPAL_DISBURSEMENT_FEE = 'loanPrincipalDisbursementFee',
  LOAN_REPAYMENT = 'loanRepayment',
  LOAN_COLLATERAL_RELEASE = 'loanCollateralRelease',
  LOAN_COLLATERAL_RETURNED = 'loanCollateralReturned',
  LOAN_COLLATERAL_RELEASED = 'loanCollateralReleased',
  LOAN_LIQUIDATION_RELEASE = 'loanLiquidationRelease',
  LOAN_LIQUIDATION_SURPLUS = 'loanLiquidationSurplus',
  LOAN_LIQUIDATION_RELEASE_FEE = 'loanLiquidationReleaseFee',
  LOAN_PRINCIPAL_FUNDED = 'loanPrincipalFunded',
  LOAN_OFFER_PRINCIPAL_ESCROWED = 'loanOfferPrincipalEscrowed',
  LOAN_PRINCIPAL_RETURNED = 'loanPrincipalReturned',
  LOAN_PRINCIPAL_RETURNED_FEE = 'loanPrincipalReturnedFee',
  LOAN_INTEREST_RECEIVED = 'loanInterestReceived',
  LOAN_REPAYMENT_RECEIVED = 'loanRepaymentReceived',
  LOAN_LIQUIDATION_REPAYMENT = 'loanLiquidationRepayment',
  LOAN_DISBURSEMENT_PRINCIPAL = 'loanDisbursementPrincipal',
  LOAN_DISBURSEMENT_FEE = 'loanDisbursementFee',
  LOAN_REDELIVERY_FEE = 'loanRedeliveryFee',
  LOAN_LIQUIDATION_FEE = 'loanLiquidationFee',
  LOAN_LIQUIDATION_COLLATERAL_USED = 'loanLiquidationCollateralUsed',
  WITHDRAWAL_REQUESTED = 'withdrawalRequested',
  WITHDRAWAL_REFUNDED = 'withdrawalRefunded',
  PLATFORM_FEE_CHARGED = 'platformFeeCharged',
  PLATFORM_FEE_REFUNDED = 'platformFeeRefunded',
}

export class CurrencyDto {
  @ApiProperty({
    description: 'Blockchain key identifier',
    example: 'slip44:0',
  })
  @IsString()
  blockchainKey: string;

  @ApiProperty({
    description: 'Token identifier',
    example: 'slip44:0',
  })
  @IsString()
  tokenId: string;

  @ApiProperty({
    description: 'Currency name',
    example: 'Bitcoin',
  })
  @IsString()
  name: string;

  @ApiProperty({
    description: 'Currency symbol',
    example: 'BTC',
  })
  @IsString()
  symbol: string;

  @ApiProperty({
    description: 'Number of decimal places',
    example: 8,
  })
  @IsNumber()
  @IsPositive()
  decimals: number;

  @ApiProperty({
    description: 'Currency logo URL',
    example: 'https://assets.cryptogadai.com/currencies/btc.png',
  })
  @IsUrl()
  logoUrl: string;
}

export class PendingOperationsDto {
  @ApiProperty({
    description: 'Pending incoming amount',
    example: '0.000000000000000000',
  })
  @IsString()
  incoming: string;

  @ApiProperty({
    description: 'Pending outgoing amount',
    example: '0.000000000000000000',
  })
  @IsString()
  outgoing: string;

  @ApiProperty({
    description: 'Net pending amount',
    example: '0.000000000000000000',
  })
  @IsString()
  net: string;
}

export class AccountBalanceDto {
  @ApiProperty({
    description: 'Account ID',
    example: 123,
  })
  @IsNumber()
  @IsPositive()
  id: number;

  @ApiProperty({
    description: 'Currency information',
  })
  currency: CurrencyDto;

  @ApiProperty({
    description: 'Current account balance',
    example: '0.01000000',
  })
  @IsString()
  balance: string;

  @ApiProperty({
    description: 'Pending operations for this account',
  })
  pendingOperations: PendingOperationsDto;

  @ApiProperty({
    description: 'Last updated timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  @IsDateString()
  lastUpdated: string;
}

export class AccountMutationDto {
  @ApiProperty({
    description: 'Mutation ID',
    example: 456,
  })
  @IsNumber()
  @IsPositive()
  id: number;

  @ApiProperty({
    description: 'Type of mutation',
    enum: AccountMutationType,
    example: AccountMutationType.INVOICE_RECEIVED,
  })
  @IsEnum(AccountMutationType)
  mutationType: AccountMutationType;

  @ApiProperty({
    description: 'Date when the mutation occurred',
    example: '2024-01-15T10:30:00Z',
  })
  @IsDateString()
  mutationDate: string;

  @ApiProperty({
    description: 'Mutation amount (positive for credit, negative for debit)',
    example: '-0.001000000000000000',
  })
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'Human-readable description of the mutation',
    example: 'Invoice payment received for invoice #123',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Reference ID (invoice ID, withdrawal ID, etc.)',
    example: 123,
  })
  @IsOptional()
  @IsNumber()
  @IsPositive()
  referenceId?: number;

  @ApiPropertyOptional({
    description: 'Type of reference (invoice, withdrawal, etc.)',
    example: 'invoice',
  })
  @IsOptional()
  @IsString()
  referenceType?: string;
}

export class PaginationMetaDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  @IsNumber()
  @IsPositive()
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  @IsNumber()
  @IsPositive()
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 100,
  })
  @IsNumber()
  @Min(0)
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  @IsNumber()
  @IsPositive()
  totalPages: number;

  @ApiProperty({
    description: 'Whether there is a next page',
    example: true,
  })
  @IsBoolean()
  hasNext: boolean;

  @ApiProperty({
    description: 'Whether there is a previous page',
    example: false,
  })
  @IsBoolean()
  hasPrev: boolean;
}

export class GetAccountMutationsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number',
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Filter by mutation type',
    enum: AccountMutationType,
  })
  @IsOptional()
  @IsEnum(AccountMutationType)
  mutationType?: AccountMutationType;

  @ApiPropertyOptional({
    description: 'Filter mutations from this date',
    example: '2024-01-01T00:00:00Z',
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({
    description: 'Filter mutations to this date',
    example: '2024-12-31T23:59:59Z',
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class AccountBalancesResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Account balances data',
  })
  data: {
    balances: AccountBalanceDto[];
  };
}

export class AccountMutationsResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Account mutations data',
  })
  data: {
    mutations: AccountMutationDto[];
    pagination: PaginationMetaDto;
  };
}
