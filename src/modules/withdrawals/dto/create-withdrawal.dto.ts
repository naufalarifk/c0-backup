import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsNumberString, IsString, Matches } from 'class-validator';

export class CreateWithdrawalDto {
  @ApiProperty({
    description: 'Blockchain key (CAIP-2 format)',
    example: 'eip155:56',
  })
  @IsNotEmpty({ message: 'Currency blockchain key is required' })
  @IsString({ message: 'Currency blockchain key must be a valid text' })
  @Transform(({ value }) => value?.trim())
  currencyBlockchainKey: string;

  @ApiProperty({
    description: 'Token ID on the blockchain',
    example: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  })
  @IsNotEmpty({ message: 'Currency token ID is required' })
  @IsString({ message: 'Currency token ID must be a valid text' })
  @Transform(({ value }) => value?.trim())
  currencyTokenId: string;

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
