import { ApiProperty, OmitType } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

import { UserAppliesForInstitutionParams } from '../../../shared/types';

export class CreateInstitutionDto
  implements Omit<UserAppliesForInstitutionParams, 'applicantUserId' | 'applicationDate'>
{
  @ApiProperty({
    description: 'NPWP document storage path in format bucket:path',
    example: 'documents:institutions/13/npwp-document-1757496173043-npwp.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'NPWP document must be in format bucket:institutions/userId/filename',
  })
  npwpDocumentPath: string;

  @ApiProperty({
    description: 'Registration document storage path in format bucket:path',
    example: 'documents:institutions/13/registration-document-1757496173043-registration.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'Registration document must be in format bucket:institutions/userId/filename',
  })
  registrationDocumentPath: string;

  @ApiProperty({
    description: 'Deed of establishment document storage path in format bucket:path',
    example: 'documents:institutions/13/deed-of-establishment-1757496173043-deed.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'Deed of establishment document must be in format bucket:institutions/userId/filename',
  })
  deedOfEstablishmentPath: string;

  @ApiProperty({
    description: 'Director ID card storage path in format bucket:path',
    example: 'documents:institutions/13/director-id-card-1757496173043-director-id.jpg',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'Director ID card must be in format bucket:institutions/userId/filename',
  })
  directorIdCardPath: string;

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
    description: 'Business registration number',
    example: 'AHU-0012345.AH.01.01.TAHUN 2023',
  })
  @IsNotEmpty()
  @IsString()
  registrationNumber: string;

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
}

// DTO for form data submission (without file URLs - files will be uploaded separately)
export class SubmitCreateInstitutionDto extends OmitType(CreateInstitutionDto, [
  'npwpDocumentPath',
  'registrationDocumentPath',
  'deedOfEstablishmentPath',
  'directorIdCardPath',
] as const) {}
