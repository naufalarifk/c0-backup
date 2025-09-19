import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsPositive, IsString, Min } from 'class-validator';

export class WithdrawalLimitsDto {
  @ApiProperty({
    description: 'Minimum withdrawal amount',
    example: '10.00',
  })
  @IsNotEmpty()
  @IsNumber({}, { message: 'Minimum amount must be a number' })
  @IsPositive({ message: 'Minimum amount must be positive' })
  @Type(() => Number)
  minAmount: number;

  @ApiProperty({
    description: 'Maximum withdrawal amount per transaction',
    example: '50000.00',
  })
  @IsNotEmpty()
  @IsNumber({}, { message: 'Maximum amount must be a number' })
  @IsPositive({ message: 'Maximum amount must be positive' })
  @Type(() => Number)
  maxAmount: number;

  @ApiProperty({
    description: 'Daily withdrawal limit',
    example: '100000.00',
  })
  @IsNotEmpty()
  @IsNumber({}, { message: 'Daily limit must be a number' })
  @IsPositive({ message: 'Daily limit must be positive' })
  @Type(() => Number)
  dailyLimit: number;

  @ApiProperty({
    description: 'Currency blockchain key',
    example: 'eip155:56',
  })
  @IsNotEmpty()
  @IsString()
  blockchainKey: string;

  @ApiProperty({
    description: 'Currency token ID',
    example: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  })
  @IsNotEmpty()
  @IsString()
  tokenId: string;
}

export class WithdrawalFeeDto {
  @ApiProperty({
    description: 'Fee amount in the withdrawal currency',
    example: '5.00',
  })
  @IsNotEmpty()
  @IsNumber({}, { message: 'Fee amount must be a number' })
  @Min(0, { message: 'Fee amount cannot be negative' })
  @Type(() => Number)
  feeAmount: number;

  @ApiProperty({
    description: 'Fee percentage (0-100)',
    example: '0.5',
  })
  @IsNotEmpty()
  @IsNumber({}, { message: 'Fee percentage must be a number' })
  @Min(0, { message: 'Fee percentage cannot be negative' })
  @Type(() => Number)
  feePercentage: number;

  @ApiProperty({
    description: 'Network fee estimate',
    example: '2.50',
  })
  @IsNumber({}, { message: 'Network fee must be a number' })
  @Min(0, { message: 'Network fee cannot be negative' })
  @Type(() => Number)
  networkFee?: number;
}
