import { ApiProperty } from '@nestjs/swagger';

import { IsDateString, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

import { UserSubmitsKycParams } from '../../../../shared/types';

export class CreateKycDto implements Omit<UserSubmitsKycParams, 'userId' | 'submissionDate'> {
  @ApiProperty({ description: 'ID card photo URL or base64 string' })
  @IsString()
  @IsNotEmpty()
  idCardPhoto: string;

  @ApiProperty({ description: 'Selfie photo URL or base64 string' })
  @IsString()
  @IsNotEmpty()
  selfiePhoto: string;

  @ApiProperty({ description: 'Selfie with ID card photo URL or base64 string' })
  @IsString()
  @IsNotEmpty()
  selfieWithIdCardPhoto: string;

  @ApiProperty({ description: 'National Identity Number (NIK) - 16 digits' })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16, { message: 'NIK must be exactly 16 digits' })
  @Matches(/^\d{16}$/, { message: 'NIK must contain only digits' })
  nik: string;

  @ApiProperty({ description: 'Full name as on ID card' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 100, { message: 'Name must be between 2 and 100 characters' })
  @Matches(/^[a-zA-Z\s.'-]+$/, {
    message: 'Name can only contain letters, spaces, dots, and apostrophes',
  })
  fullName: string;

  @ApiProperty({ description: 'City of birth' })
  @IsString()
  @IsNotEmpty()
  birthCity: string;

  @ApiProperty({ description: 'Date of birth (YYYY-MM-DD)' })
  @IsNotEmpty()
  @IsDateString({}, { message: 'Birth date must be a valid date string' })
  birthDate: Date;

  @ApiProperty({ description: 'Province name' })
  @IsString()
  @IsNotEmpty()
  province: string;

  @ApiProperty({ description: 'City name' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ description: 'District name' })
  @IsString()
  @IsNotEmpty()
  district: string;

  @ApiProperty({ description: 'Subdistrict name' })
  @IsString()
  @IsNotEmpty()
  subdistrict: string;

  @ApiProperty({ description: 'Complete address' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ description: 'Postal code - 5 digits' })
  @IsString()
  @IsNotEmpty()
  @Length(5, 5, { message: 'Postal code must be exactly 5 digits' })
  @Matches(/^\d{5}$/, { message: 'Postal code must contain only digits' })
  postalCode: string;

  @ApiProperty({ description: 'Phone number (Indonesian format)' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\+62|62|0)[8-9]\d{7,11}$/, { message: 'Invalid Indonesian phone number format' })
  phoneNumber: string;
}
