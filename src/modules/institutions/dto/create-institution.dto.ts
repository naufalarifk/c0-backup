import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

import { UserAppliesForInstitutionParams } from '../../../shared/types';

export class CreateInstitutionDto
  implements Omit<UserAppliesForInstitutionParams, 'applicantUserId' | 'applicationDate'>
{
  @ApiProperty({
    description: 'Name of the business/institution',
    example: 'PT. Teknologi Finansial Indonesia',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessName: string;

  @ApiProperty({
    description: 'Description of the business (optional)',
    example: 'Financial technology company providing digital banking services',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessDescription?: string;

  @ApiProperty({
    description: 'Type of business (optional)',
    example: 'Financial Technology',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessType?: string;

  @ApiProperty({
    description: 'NPWP (Tax ID) number',
    example: '01.234.567.8-901.000',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{2}\.\d{3}\.\d{3}\.\d{1}-\d{3}\.\d{3}$/, {
    message: 'NPWP number must be in format: XX.XXX.XXX.X-XXX.XXX',
  })
  npwpNumber: string;

  @ApiProperty({
    description: 'Path to NPWP document file',
    example: '/uploads/documents/npwp_123456.pdf',
  })
  @IsNotEmpty()
  @IsString()
  npwpDocumentPath: string;

  @ApiProperty({
    description: 'Business registration number',
    example: 'AHU-0012345.AH.01.01.TAHUN 2023',
  })
  @IsNotEmpty()
  @IsString()
  registrationNumber: string;

  @ApiProperty({
    description: 'Path to business registration document',
    example: '/uploads/documents/registration_123456.pdf',
  })
  @IsNotEmpty()
  @IsString()
  registrationDocumentPath: string;

  @ApiProperty({
    description: 'Path to deed of establishment document',
    example: '/uploads/documents/deed_123456.pdf',
  })
  @IsNotEmpty()
  @IsString()
  deedOfEstablishmentPath: string;

  @ApiProperty({
    description: 'Business address',
    example: 'Jl. Sudirman No. 123, Jakarta Pusat',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessAddress: string;

  @ApiProperty({
    description: 'Business city',
    example: 'Jakarta',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessCity: string;

  @ApiProperty({
    description: 'Business province',
    example: 'DKI Jakarta',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessProvince: string;

  @ApiProperty({
    description: 'Business postal code',
    example: '10220',
  })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{5}$/, {
    message: 'Postal code must be 5 digits',
  })
  businessPostalCode: string;

  @ApiProperty({
    description: 'Name of the company director',
    example: 'John Doe',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  directorName: string;

  @ApiProperty({
    description: 'Path to director ID card document',
    example: '/uploads/documents/director_id_123456.jpg',
  })
  @IsNotEmpty()
  @IsString()
  directorIdCardPath: string;
}
