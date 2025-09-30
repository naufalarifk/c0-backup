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
  INVOICE_RECEIVED = 'InvoiceReceived',
  LOAN_COLLATERAL_DEPOSIT = 'LoanCollateralDeposit',
  LOAN_APPLICATION_COLLATERAL_ESCROWED = 'LoanApplicationCollateralEscrowed',
  LOAN_PRINCIPAL_DISBURSEMENT = 'LoanPrincipalDisbursement',
  LOAN_DISBURSEMENT_RECEIVED = 'LoanDisbursementReceived',
  LOAN_PRINCIPAL_DISBURSEMENT_FEE = 'LoanPrincipalDisbursementFee',
  LOAN_REPAYMENT = 'LoanRepayment',
  LOAN_COLLATERAL_RELEASE = 'LoanCollateralRelease',
  LOAN_COLLATERAL_RETURNED = 'LoanCollateralReturned',
  LOAN_COLLATERAL_RELEASED = 'LoanCollateralReleased',
  LOAN_LIQUIDATION_RELEASE = 'LoanLiquidationRelease',
  LOAN_LIQUIDATION_SURPLUS = 'LoanLiquidationSurplus',
  LOAN_LIQUIDATION_RELEASE_FEE = 'LoanLiquidationReleaseFee',
  LOAN_PRINCIPAL_FUNDED = 'LoanPrincipalFunded',
  LOAN_OFFER_PRINCIPAL_ESCROWED = 'LoanOfferPrincipalEscrowed',
  LOAN_PRINCIPAL_RETURNED = 'LoanPrincipalReturned',
  LOAN_PRINCIPAL_RETURNED_FEE = 'LoanPrincipalReturnedFee',
  LOAN_INTEREST_RECEIVED = 'LoanInterestReceived',
  LOAN_REPAYMENT_RECEIVED = 'LoanRepaymentReceived',
  LOAN_LIQUIDATION_REPAYMENT = 'LoanLiquidationRepayment',
  LOAN_DISBURSEMENT_PRINCIPAL = 'LoanDisbursementPrincipal',
  LOAN_DISBURSEMENT_FEE = 'LoanDisbursementFee',
  LOAN_RETURN_FEE = 'LoanReturnFee',
  LOAN_LIQUIDATION_FEE = 'LoanLiquidationFee',
  LOAN_LIQUIDATION_COLLATERAL_USED = 'LoanLiquidationCollateralUsed',
  WITHDRAWAL_REQUESTED = 'WithdrawalRequested',
  WITHDRAWAL_REFUNDED = 'WithdrawalRefunded',
  PLATFORM_FEE_CHARGED = 'PlatformFeeCharged',
  PLATFORM_FEE_REFUNDED = 'PlatformFeeRefunded',
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

export class ValuationDto {
  @ApiProperty({
    description: 'Balance value in USD',
    example: '2451.25',
  })
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'Valuation currency',
  })
  currency: CurrencyDto;

  @ApiProperty({
    description: 'Exchange rate used for valuation',
    example: '1.960000000000000000',
  })
  @IsString()
  exchangeRate: string;

  @ApiProperty({
    description: 'Source of the exchange rate',
    example: 'coinbase',
  })
  @IsString()
  rateSource: string;

  @ApiProperty({
    description: 'Timestamp of the exchange rate',
    example: '2025-08-11T10:29:45Z',
  })
  @IsDateString()
  rateDate: string;
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
    example: '1250.750000000000000000',
  })
  @IsString()
  balance: string;

  @ApiProperty({
    description: 'Last updated timestamp',
    example: '2025-08-11T10:30:00Z',
  })
  @IsDateString()
  lastUpdated: string;

  @ApiPropertyOptional({
    description: 'Valuation information (optional)',
    type: ValuationDto,
  })
  @IsOptional()
  valuation?: ValuationDto;
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

  @ApiPropertyOptional({
    description: 'Account balance after this mutation',
    example: '2250.750000000000000000',
  })
  @IsOptional()
  @IsString()
  balanceAfter?: string;
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
    accounts: AccountBalanceDto[];
    totalPortfolioValue: {
      amount: string;
      currency: string;
      lastUpdated: string;
    };
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

// Portfolio Management DTOs
export class PaymentAlertDto {
  @ApiProperty({
    description: 'Loan identifier',
    example: 'loan_789',
  })
  @IsString()
  loanId: string;

  @ApiProperty({
    description: 'Days until payment is due (negative if overdue)',
    example: 3,
  })
  @IsNumber()
  daysUntilDue: number;

  @ApiProperty({
    description: 'Amount due for payment',
    example: '10000.00',
  })
  @IsString()
  paymentAmount: string;

  @ApiProperty({
    description: 'Payment currency',
    example: 'USDT',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Amount of collateral at risk',
    example: '5.0',
  })
  @IsString()
  collateralAtRisk: string;

  @ApiProperty({
    description: 'Collateral currency',
    example: 'ETH',
  })
  @IsString()
  collateralCurrency: string;

  @ApiProperty({
    description: 'Whether liquidation warning should be shown',
    example: true,
  })
  @IsBoolean()
  liquidationWarning: boolean;
}

export class PaymentAlertsDto {
  @ApiProperty({
    description: 'Upcoming payment alerts',
    type: [PaymentAlertDto],
  })
  upcomingPayments: PaymentAlertDto[];

  @ApiProperty({
    description: 'Overdue payment alerts',
    type: [PaymentAlertDto],
  })
  overduePayments: PaymentAlertDto[];
}

export class PortfolioAnalyticsDto {
  @ApiProperty({
    description: 'Total portfolio value information',
  })
  totalPortfolioValue: {
    amount: string;
    currency: string;
    isLocked: boolean;
    lastUpdated: string;
  };

  @ApiProperty({
    description: 'Interest growth metrics',
  })
  interestGrowth: {
    amount: string;
    currency: string;
    percentage: number;
    isPositive: boolean;
    periodLabel: string;
  };

  @ApiProperty({
    description: 'Active loans statistics',
  })
  activeLoans: {
    count: number;
    borrowerLoans: number;
    lenderLoans: number;
    totalCollateralValue: string;
    averageLTV: number;
  };

  @ApiProperty({
    description: 'Portfolio period information',
  })
  portfolioPeriod: {
    displayMonth: string;
    startDate: string;
    endDate: string;
  };

  @ApiProperty({
    description: 'Payment alerts',
    type: PaymentAlertsDto,
  })
  paymentAlerts: PaymentAlertsDto;

  @ApiProperty({
    description: 'Asset allocation breakdown',
  })
  assetBreakdown: {
    cryptoAssets: {
      percentage: number;
      value: string;
    };
    stablecoins: {
      percentage: number;
      value: string;
    };
    loanCollateral: {
      percentage: number;
      value: string;
    };
  };
}

export class PortfolioAnalyticsResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Portfolio analytics data',
    type: PortfolioAnalyticsDto,
  })
  data: PortfolioAnalyticsDto;
}

export class MonetaryValueDto {
  @ApiProperty({
    description: 'Monetary amount',
    example: '125750.00',
  })
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'Currency information',
    type: CurrencyDto,
  })
  currency: CurrencyDto;
}

export class AssetAllocationDto {
  @ApiProperty({
    description: 'Asset currency information',
    type: CurrencyDto,
  })
  currency: CurrencyDto;

  @ApiProperty({
    description: 'Raw balance in smallest currency unit',
    example: '150000000',
  })
  @IsString()
  balance: string;

  @ApiProperty({
    description: 'Asset value in USD',
    type: MonetaryValueDto,
  })
  value: MonetaryValueDto;

  @ApiProperty({
    description: 'Percentage of total portfolio value',
    example: 80.45,
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  percentage: number;
}

export class PerformanceMetricDto {
  @ApiProperty({
    description: 'Absolute change amount in USD',
    example: '2540.50',
  })
  @IsString()
  amount: string;

  @ApiProperty({
    description: 'Currency code for the amount',
    example: 'USD',
  })
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Percentage change',
    example: 2.06,
  })
  @IsNumber()
  percentage: number;
}

export class PortfolioPerformanceDto {
  @ApiProperty({
    description: 'Daily performance',
    type: PerformanceMetricDto,
  })
  daily: PerformanceMetricDto;

  @ApiProperty({
    description: 'Weekly performance',
    type: PerformanceMetricDto,
  })
  weekly: PerformanceMetricDto;

  @ApiProperty({
    description: 'Monthly performance',
    type: PerformanceMetricDto,
  })
  monthly: PerformanceMetricDto;
}

export class PortfolioOverviewDto {
  @ApiProperty({
    description: 'Total portfolio value',
    type: MonetaryValueDto,
  })
  totalValue: MonetaryValueDto;

  @ApiProperty({
    description: 'Asset allocation breakdown',
    type: [AssetAllocationDto],
  })
  assetAllocation: AssetAllocationDto[];

  @ApiProperty({
    description: 'Performance metrics',
    type: PortfolioPerformanceDto,
  })
  performance: PortfolioPerformanceDto;

  @ApiProperty({
    description: 'Last updated timestamp',
    example: '2025-09-22T10:30:00Z',
  })
  @IsDateString()
  lastUpdated: string;
}

export class PortfolioOverviewResponseDto {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Portfolio overview data',
    type: PortfolioOverviewDto,
  })
  data: PortfolioOverviewDto;
}
