import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsDateString, IsEnum, IsNumber, IsString } from 'class-validator';

import { CurrencyDto, IsDecimalAmount } from './common.dto';

export class EarlyLiquidationRequestDto {
  @ApiProperty({
    description: 'Borrower acknowledges terms and conditions',
    example: true,
  })
  @IsBoolean()
  acknowledgment: boolean;
}

export class EarlyRepaymentRequestDto {
  @ApiProperty({
    description: 'Borrower acknowledges terms and conditions',
    example: true,
  })
  @IsBoolean()
  acknowledgment: boolean;
}

export class CollateralValuationDto {
  @ApiProperty({ type: CurrencyDto })
  @Type(() => CurrencyDto)
  collateralCurrency: CurrencyDto;

  @ApiProperty({
    description: 'Current collateral amount',
    example: '5.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  currentAmount: string;

  @ApiProperty({
    description: 'Current market value details',
  })
  currentMarketValue: {
    amount: string;
    currency: CurrencyDto;
    exchangeRate: string;
    rateSource: string;
    rateTimestamp: string;
  };

  @ApiProperty({
    description: 'Current loan-to-value ratio',
    example: '87.2',
  })
  @IsString()
  currentLtvRatio: string;

  @ApiProperty({
    description: 'Original loan-to-value ratio at loan origination',
    example: '70.0',
  })
  @IsString()
  originalLtvRatio: string;

  @ApiProperty({
    description: 'LTV change details',
  })
  ltvChange: {
    percentage: string;
    direction: 'improved' | 'worsened' | 'stable';
  };
}

export class LiquidationBreakdownDto {
  @ApiProperty({
    description: 'Outstanding loan details',
  })
  outstandingLoan: {
    principalAmount: string;
    interestAmount: string;
    originationFeeAmount: string;
    totalLoanRepayment: string;
  };

  @ApiProperty({
    description: 'Liquidation fees',
  })
  liquidationFees: {
    earlyLiquidationFee: string;
    earlyLiquidationFeeRate: string;
    marketLiquidationFee: string;
    totalLiquidationFees: string;
  };

  @ApiProperty({
    description: 'Total amount to be deducted',
    example: '11034.000000000000000000',
    pattern: '^\\d+\\.\\d{18}$',
  })
  @IsString()
  @IsDecimalAmount()
  totalDeductions: string;

  @ApiProperty({
    description: 'Calculation details',
  })
  calculationDetails: {
    basedOnExchangeRate: string;
    rateSource: string;
    rateTimestamp: string;
  };
}

export class EarlyLiquidationEstimateDataDto {
  @ApiProperty({
    description: 'Loan identifier',
    example: '12345',
  })
  @IsString()
  loanId: string;

  @ApiProperty({ type: CollateralValuationDto })
  @Type(() => CollateralValuationDto)
  currentValuation: CollateralValuationDto;

  @ApiProperty({ type: LiquidationBreakdownDto })
  @Type(() => LiquidationBreakdownDto)
  liquidationBreakdown: LiquidationBreakdownDto;

  @ApiProperty({
    description: 'Estimated liquidation outcome',
  })
  estimatedOutcome: {
    totalLiquidationProceeds: string;
    totalDeductions: string;
    estimatedSurplus: string;
    breakeven: boolean;
  };

  @ApiProperty({
    description: 'When this estimate was calculated',
    example: '2025-08-13T15:30:00Z',
  })
  @IsDateString()
  calculationDate: string;

  @ApiProperty({
    description: 'Important disclaimers about the estimate',
    example: [
      'Actual liquidation proceeds may vary due to market conditions',
      'Exchange rates are subject to change until execution',
      'Early liquidation fee of 1% is final and non-refundable',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  disclaimers: string[];
}

export class EarlyLiquidationEstimateResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ type: EarlyLiquidationEstimateDataDto })
  @Type(() => EarlyLiquidationEstimateDataDto)
  data: EarlyLiquidationEstimateDataDto;
}

export class EarlyLiquidationRequestDataDto {
  @ApiProperty({
    description: 'Unique liquidation request identifier',
    example: 'liq_67890',
  })
  @IsString()
  liquidationId: string;

  @ApiProperty({
    description: 'Associated loan identifier',
    example: '12345',
  })
  @IsString()
  loanId: string;

  @ApiProperty({
    description: 'Current liquidation status',
    enum: ['Pending', 'Processing', 'Fulfilled', 'Failed'],
    example: 'Pending',
  })
  @IsEnum(['Pending', 'Processing', 'Fulfilled', 'Failed'])
  status: 'Pending' | 'Processing' | 'Fulfilled' | 'Failed';

  @ApiProperty({
    description: 'When the liquidation request was submitted',
    example: '2025-08-13T15:30:00Z',
  })
  @IsDateString()
  submittedDate: string;

  @ApiProperty({
    description: 'Estimated completion time for liquidation',
    example: '2-4 hours',
  })
  @IsString()
  estimatedCompletionTime: string;

  @ApiProperty({ type: LiquidationBreakdownDto })
  @Type(() => LiquidationBreakdownDto)
  finalBreakdown: LiquidationBreakdownDto;

  @ApiProperty({
    description: 'What happens next in the process',
    example: [
      'Collateral will be liquidated on the market',
      'Loan payment will be processed',
      'Any surplus will be credited to your account',
      'You will receive email confirmation when complete',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  nextSteps: string[];
}

export class EarlyLiquidationRequestResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ type: EarlyLiquidationRequestDataDto })
  @Type(() => EarlyLiquidationRequestDataDto)
  data: EarlyLiquidationRequestDataDto;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'Early liquidation request submitted successfully',
  })
  @IsString()
  message: string;
}

export class RepaymentBreakdownDto {
  @ApiProperty({
    description: 'Loan details',
  })
  loanDetails: {
    principalAmount: string;
    interestAmount: string;
    originationFeeAmount: string;
    totalRepaymentAmount: string;
  };

  @ApiProperty({
    description: 'Payment terms',
  })
  paymentTerms: {
    earlyPaymentFee: string;
    interestReduction: string;
    paymentCurrency: CurrencyDto;
  };

  @ApiProperty({
    description: 'Calculation details',
  })
  calculationDetails: {
    originalTermMonths: number;
    earlyPaymentAtMonth: number;
    remainingTermMonths: number;
    calculationDate: string;
  };

  @ApiProperty({
    description: 'Important disclaimers about early repayment',
    example: [
      'Full interest amount is charged regardless of early payment',
      'Origination fee (3% of principal) is charged in full',
      'No early payment fee or penalty applies',
      'Payment must be made in full to complete early repayment',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  disclaimers: string[];
}

export class EarlyRepaymentRequestDataDto {
  @ApiProperty({
    description: 'Unique repayment request identifier',
    example: 'rep_12345',
  })
  @IsString()
  repaymentId: string;

  @ApiProperty({
    description: 'Associated loan identifier',
    example: '12345',
  })
  @IsString()
  loanId: string;

  @ApiProperty({
    description: 'Current repayment status',
    enum: ['Pending', 'Processing', 'Completed', 'Failed'],
    example: 'Pending',
  })
  @IsEnum(['Pending', 'Processing', 'Completed', 'Failed'])
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';

  @ApiProperty({
    description: 'When the repayment request was submitted',
    example: '2025-08-13T15:30:00Z',
  })
  @IsDateString()
  submittedDate: string;

  @ApiProperty({ type: RepaymentBreakdownDto })
  @Type(() => RepaymentBreakdownDto)
  repaymentBreakdown: RepaymentBreakdownDto;

  @ApiProperty({
    description: 'Repayment invoice details',
  })
  repaymentInvoice: {
    id: string;
    amount: string;
    currency: CurrencyDto;
    walletAddress: string;
    expiryDate: string;
    paidDate?: string;
    expiredDate?: string;
  };

  @ApiProperty({
    description: 'What happens next in the process',
    example: [
      'Payment invoice has been created',
      'Pay the invoice to complete early repayment',
      'Collateral will be released upon payment confirmation',
      'You will receive email confirmation when complete',
    ],
  })
  @IsArray()
  @IsString({ each: true })
  nextSteps: string[];
}

export class EarlyRepaymentRequestResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({ type: EarlyRepaymentRequestDataDto })
  @Type(() => EarlyRepaymentRequestDataDto)
  data: EarlyRepaymentRequestDataDto;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'Early repayment request submitted successfully',
  })
  @IsString()
  message: string;
}
