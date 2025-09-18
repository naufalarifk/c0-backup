import { ApiProperty } from '@nestjs/swagger';

import { IsBoolean, IsString } from 'class-validator';

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

export interface EarlyLiquidationEstimateData {
  loanId: string;
  calculationDate: string;
  currentCollateralValue: string;
  currentLtvRatio: number;
  liquidationFee: string;
  estimatedProceeds: string;
  disclaimers: string[];
}

export class EarlyLiquidationEstimateResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Estimation data - contains loan ID, valuation details, breakdown and outcome',
  })
  data: EarlyLiquidationEstimateData;
}

export interface EarlyLiquidationRequestData {
  liquidationId: string;
  loanId: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  submittedDate: string;
  estimatedCompletionTime: string;
  nextSteps: string[];
}

export class EarlyLiquidationRequestResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description: 'Liquidation request data - contains liquidation ID, status, and next steps',
  })
  data: EarlyLiquidationRequestData;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'Early liquidation request submitted successfully',
  })
  @IsString()
  message: string;
}

export interface EarlyRepaymentRequestData {
  repaymentId: string;
  loanId: string;
  repaymentAmount: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed';
  submittedDate: string;
  nextSteps: string[];
}

export class EarlyRepaymentRequestResponseDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  success: boolean;

  @ApiProperty({
    description:
      'Repayment request data - contains repayment ID, breakdown, invoice and next steps',
  })
  data: EarlyRepaymentRequestData;

  @ApiProperty({
    description: 'Confirmation message',
    example: 'Early repayment request submitted successfully',
  })
  @IsString()
  message: string;
}
