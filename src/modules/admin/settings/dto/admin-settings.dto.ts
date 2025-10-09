import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export enum LoanLiquidationMode {
  Partial = 'Partial',
  Full = 'Full',
}

export class PlatformConfigDto {
  @ApiProperty({
    description: 'When this configuration became/becomes effective',
    format: 'date-time',
    example: '2024-01-01T00:00:00Z',
  })
  effectiveDate: string;

  @ApiProperty({
    description: 'Admin who set this configuration',
    format: 'int64',
    example: 1,
  })
  adminUserId: number;

  @ApiProperty({
    description: 'Name of admin who set this configuration (optional)',
    example: 'Admin User',
    nullable: true,
  })
  @IsOptional()
  adminUserName?: string | null;

  @ApiProperty({
    description: 'Platform provision rate applied to loans as decimal (e.g., 0.03 = 3%)',
    format: 'decimal',
    example: 0.03,
  })
  loanProvisionRate: number;

  @ApiProperty({
    description: 'Redelivery fee rate applied to individual loans as decimal (e.g., 0.10 = 10%)',
    format: 'decimal',
    example: 0.1,
  })
  loanIndividualRedeliveryFeeRate: number;

  @ApiProperty({
    description: 'Redelivery fee rate applied to institution loans as decimal (e.g., 0.025 = 2.5%)',
    format: 'decimal',
    example: 0.025,
  })
  loanInstitutionRedeliveryFeeRate: number;

  @ApiProperty({
    description: 'Minimum allowed loan-to-value ratio as decimal (e.g., 0.60 = 60%)',
    format: 'decimal',
    example: 0.6,
  })
  loanMinLtvRatio: number;

  @ApiProperty({
    description: 'Maximum allowed loan-to-value ratio as decimal (e.g., 0.75 = 75%)',
    format: 'decimal',
    example: 0.75,
  })
  loanMaxLtvRatio: number;

  @ApiProperty({
    description: 'Loan repayment duration in days',
    example: 3,
  })
  loanRepaymentDurationInDays: number;

  @ApiProperty({
    description: 'Default liquidation mode for loans',
    enum: LoanLiquidationMode,
    example: LoanLiquidationMode.Partial,
  })
  loanLiquidationMode: LoanLiquidationMode;

  @ApiProperty({
    description: 'Liquidation premium rate as decimal (e.g., 0.02 = 2%)',
    format: 'decimal',
    example: 0.02,
  })
  loanLiquidationPremiRate: number;

  @ApiProperty({
    description: 'Liquidation fee rate as decimal (e.g., 0.02 = 2%)',
    format: 'decimal',
    example: 0.02,
  })
  loanLiquidationFeeRate: number;
}

export class PlatformConfigResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Platform configuration data',
    type: PlatformConfigDto,
  })
  data: PlatformConfigDto;
}

export class PlatformConfigUpdateDto {
  @ApiProperty({
    description: 'Platform provision rate applied to loans as decimal (e.g., 0.03 = 3%)',
    format: 'decimal',
    minimum: 0,
    maximum: 1,
    example: 0.03,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  loanProvisionRate: number;

  @ApiProperty({
    description: 'Redelivery fee rate applied to individual loans as decimal (e.g., 0.10 = 10%)',
    format: 'decimal',
    minimum: 0,
    maximum: 1,
    example: 0.1,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  loanIndividualRedeliveryFeeRate: number;

  @ApiProperty({
    description: 'Redelivery fee rate applied to institution loans as decimal (e.g., 0.025 = 2.5%)',
    format: 'decimal',
    minimum: 0,
    maximum: 1,
    example: 0.025,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  loanInstitutionRedeliveryFeeRate: number;

  @ApiProperty({
    description: 'Minimum allowed loan-to-value ratio as decimal (e.g., 0.60 = 60%)',
    format: 'decimal',
    minimum: 0,
    maximum: 1,
    example: 0.6,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  loanMinLtvRatio: number;

  @ApiProperty({
    description: 'Maximum allowed loan-to-value ratio as decimal (e.g., 0.75 = 75%)',
    format: 'decimal',
    minimum: 0,
    maximum: 1,
    example: 0.75,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  loanMaxLtvRatio: number;

  @ApiProperty({
    description: 'Loan repayment duration in days',
    minimum: 1,
    maximum: 3650,
    example: 3,
  })
  @Type(() => Number)
  @Min(1)
  @Max(3650)
  loanRepaymentDurationInDays: number;

  @ApiProperty({
    description: 'Default liquidation mode for loans',
    enum: LoanLiquidationMode,
    example: LoanLiquidationMode.Partial,
  })
  @IsEnum(LoanLiquidationMode)
  loanLiquidationMode: LoanLiquidationMode;

  @ApiProperty({
    description: 'Liquidation premium rate as decimal (e.g., 0.02 = 2%)',
    format: 'decimal',
    minimum: 0,
    maximum: 1,
    example: 0.02,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  loanLiquidationPremiRate: number;

  @ApiProperty({
    description: 'Liquidation fee rate as decimal (e.g., 0.02 = 2%)',
    format: 'decimal',
    minimum: 0,
    maximum: 1,
    example: 0.02,
  })
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  loanLiquidationFeeRate: number;
}

export class PlatformConfigUpdateResponseDto {
  @ApiProperty({
    description: 'Request success status',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Updated platform configuration data',
    type: PlatformConfigDto,
  })
  data: PlatformConfigDto;
}
