import type { UserSubmitsKycParams } from '../../../../shared/types';

import { ApiProperty, OmitType } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

// Custom validator for past dates
function IsNotFutureDate(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      name: 'isNotFutureDate',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value, args: ValidationArguments) {
          if (!value) return false;
          const date = new Date(value);
          const now = new Date();
          now.setHours(23, 59, 59, 999); // Allow dates up to end of today
          return date <= now;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} cannot be in the future`;
        },
      },
    });
  };
}

export class CreateKycDto implements Omit<UserSubmitsKycParams, 'userId' | 'submissionDate'> {
  @ApiProperty({
    description: 'National Identity Number (NIK) - 16 digits',
    example: '3201234567890123',
    minLength: 16,
    maxLength: 16,
  })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16, { message: 'NIK must be exactly 16 digits' })
  @Matches(/^\d{16}$/, { message: 'NIK must be exactly 16 digits' })
  @Transform(({ value }) => value?.trim())
  nik: string;

  @ApiProperty({
    description: 'Name as on Indonesian ID card (KTP)',
    example: 'SITI NURHAYATI',
    minLength: 2,
    maxLength: 160,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 160, { message: 'Name must be between 2 and 160 characters' })
  @Matches(/^[a-zA-Z\s.',-]+$/, {
    message: 'Name can only contain letters, spaces, dots, apostrophes, hyphens, and commas',
  })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' ').toUpperCase())
  name: string;

  @ApiProperty({
    description: 'City of birth',
    example: 'JAKARTA',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'Birth city must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  birthCity: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-01-15',
    format: 'date',
  })
  @IsNotEmpty()
  @IsDateString({}, { message: 'Birth date must be a valid date string (YYYY-MM-DD)' })
  @IsNotFutureDate({ message: 'Birth date cannot be in the future' })
  birthDate: Date;

  @ApiProperty({
    description: 'Province name',
    example: 'DKI JAKARTA',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'Province must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  province: string;

  @ApiProperty({
    description: 'City/Regency name',
    example: 'JAKARTA SELATAN',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'City must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  city: string;

  @ApiProperty({
    description: 'District name (Kecamatan)',
    example: 'KEBAYORAN BARU',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'District must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  district: string;

  @ApiProperty({
    description: 'Subdistrict name (Kelurahan)',
    example: 'SENAYAN',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'Subdistrict must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  subdistrict: string;

  @ApiProperty({
    description: 'Complete street address',
    example: 'JL. SUDIRMAN NO. 123, RT 001/RW 002',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 500, { message: 'Address must be between 10 and 500 characters' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' ').toUpperCase())
  address: string;

  @ApiProperty({
    description: 'Postal code - 5 digits',
    example: '12190',
    minLength: 5,
    maxLength: 5,
  })
  @IsString()
  @IsNotEmpty()
  @Length(5, 5, { message: 'Postal code must be exactly 5 digits' })
  @Matches(/^\d{5}$/, { message: 'Postal code must be exactly 5 digits' })
  @Transform(({ value }) => value?.trim())
  postalCode: string;

  @ApiProperty({
    description: 'ID card photo storage path in format bucket:path',
    example: 'documents:kyc/13/id-card-1757496173043-id-card.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-_]+:kyc\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'ID card photo must be in format bucket:kyc/userId/filename',
  })
  idCardPhoto: string;

  @ApiProperty({
    description: 'Selfie with ID card photo storage path in format bucket:path',
    example: 'documents:kyc/13/selfie-with-id-1757496173043-selfie.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-_]+:kyc\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'Selfie with ID card photo must be in format bucket:kyc/userId/filename',
  })
  selfieWithIdCardPhoto: string;

  // @ApiProperty({
  //   description: 'Phone number (Indonesian format)',
  //   example: '+6281234567890',
  //   pattern: '^(\\+62|62|0)[8-9]\\d{7,11}$',
  // })
  // @IsString()
  // @IsNotEmpty()
  // @Matches(/^(\+62|62|0)[8-9]\d{7,11}$/, {
  //   message: 'Phone number must be valid Indonesian format (+62xxx, 62xxx, or 08xxx)',
  // })
  // @Transform(({ value }) => value?.trim().replace(/\s+/g, ''))
  // phoneNumber: string;
}

// DTO for form data submission (without file URLs - files will be uploaded separately)
export class SubmitKycDto {
  @ApiProperty({
    description: 'National Identity Number (NIK) - 16 digits',
    example: '3201234567890123',
    minLength: 16,
    maxLength: 16,
  })
  @IsString()
  @IsNotEmpty()
  @Length(16, 16, { message: 'NIK must be exactly 16 digits' })
  @Matches(/^\d{16}$/, { message: 'NIK must be exactly 16 digits' })
  @Transform(({ value }) => value?.trim())
  nik: string;

  @ApiProperty({
    description: 'Name as on Indonesian ID card (KTP)',
    example: 'SITI NURHAYATI',
    minLength: 2,
    maxLength: 160,
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 160, { message: 'Name must be between 2 and 160 characters' })
  @Matches(/^[a-zA-Z\s.',-]+$/, {
    message: 'Name can only contain letters, spaces, dots, apostrophes, hyphens, and commas',
  })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' ').toUpperCase())
  name: string;

  @ApiProperty({
    description: 'City of birth',
    example: 'JAKARTA',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'Birth city must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  birthCity: string;

  @ApiProperty({
    description: 'Date of birth (YYYY-MM-DD)',
    example: '1990-01-15',
    format: 'date',
  })
  @IsNotEmpty()
  @IsDateString({}, { message: 'Birth date must be a valid date string (YYYY-MM-DD)' })
  @IsNotFutureDate({ message: 'Birth date cannot be in the future' })
  birthDate: Date;

  @ApiProperty({
    description: 'Province name',
    example: 'DKI JAKARTA',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'Province must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  province: string;

  @ApiProperty({
    description: 'City/Regency name',
    example: 'JAKARTA SELATAN',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'City must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  city: string;

  @ApiProperty({
    description: 'District name (Kecamatan)',
    example: 'KEBAYORAN BARU',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'District must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  district: string;

  @ApiProperty({
    description: 'Subdistrict name (Kelurahan)',
    example: 'SENAYAN',
  })
  @IsString()
  @IsNotEmpty()
  @Length(2, 50, { message: 'Subdistrict must be between 2 and 50 characters' })
  @Transform(({ value }) => value?.trim().toUpperCase())
  subdistrict: string;

  @ApiProperty({
    description: 'Complete street address',
    example: 'JL. SUDIRMAN NO. 123, RT 001/RW 002',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @IsNotEmpty()
  @Length(10, 500, { message: 'Address must be between 10 and 500 characters' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' ').toUpperCase())
  address: string;

  @ApiProperty({
    description: 'Postal code - 5 digits',
    example: '12190',
    minLength: 5,
    maxLength: 5,
  })
  @IsString()
  @IsNotEmpty()
  @Length(5, 5, { message: 'Postal code must be exactly 5 digits' })
  @Matches(/^\d{5}$/, { message: 'Postal code must be exactly 5 digits' })
  @Transform(({ value }) => value?.trim())
  postalCode: string;
}
