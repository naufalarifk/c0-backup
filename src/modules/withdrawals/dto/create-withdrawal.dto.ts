import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumberString, IsString, Matches } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({ example: '33', description: 'Beneficiary ID' })
  @IsNotEmpty({ message: 'Beneficiary ID is required' })
  @IsString({ message: 'Beneficiary ID must be a string' })
  @Transform(({ value }) => String(value))
  beneficiaryId: string;

  @ApiProperty({ example: '1500.50', description: 'Amount to withdraw' })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumberString({}, { message: 'Amount must be a valid number' })
  @Transform(({ value }) => String(value))
  amount: string;

  @ApiProperty({ example: '123456', description: 'Two-factor authentication code' })
  @Matches(/^\d{6}$/, { message: 'Two-factor code must be exactly 6 digits' })
  @Transform(({ value }) => String(value))
  twoFactorCode: string;
}
