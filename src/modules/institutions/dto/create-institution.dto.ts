import { ApiProperty, OmitType } from '@nestjs/swagger';

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
  @IsNotEmpty({ message: 'Business name is required' })
  @IsString({ message: 'Business name must be a valid text' })
  @Transform(({ value }) => value?.trim())
  businessName: string;

  @ApiProperty({
    description: 'Description of the business (optional)',
    example: 'Financial technology company providing digital banking services',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Business description must be a valid text' })
  @Transform(({ value }) => value?.trim())
  businessDescription?: string;

  @ApiProperty({
    description: 'Type of business (optional)',
    example: 'Financial Technology',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Business type must be a valid text' })
  @Transform(({ value }) => value?.trim())
  businessType?: string;

  @ApiProperty({
    description: 'Business address',
    example: 'Jl. Sudirman No. 123, Jakarta Pusat',
  })
  @IsNotEmpty({ message: 'Address is required' })
  @IsString({ message: 'Address must be a valid text' })
  @Transform(({ value }) => value?.trim())
  address: string;

  @ApiProperty({
    description: 'District (kecamatan)',
    example: 'Menteng',
  })
  @IsNotEmpty({ message: 'District is required' })
  @IsString({ message: 'District must be a valid text' })
  @Transform(({ value }) => value?.trim())
  district: string;

  @ApiProperty({
    description: 'Subdistrict (kelurahan)',
    example: 'Menteng',
  })
  @IsNotEmpty({ message: 'Subdistrict is required' })
  @IsString({ message: 'Subdistrict must be a valid text' })
  @Transform(({ value }) => value?.trim())
  subdistrict: string;

  @ApiProperty({
    description: 'City',
    example: 'Jakarta',
  })
  @IsNotEmpty({ message: 'City is required' })
  @IsString({ message: 'City must be a valid text' })
  @Transform(({ value }) => value?.trim())
  city: string;

  @ApiProperty({
    description: 'Province',
    example: 'DKI Jakarta',
  })
  @IsNotEmpty({ message: 'Province is required' })
  @IsString({ message: 'Province must be a valid text' })
  @Transform(({ value }) => value?.trim())
  province: string;

  @ApiProperty({
    description: 'Postal code',
    example: '10220',
  })
  @IsNotEmpty({ message: 'Postal code is required' })
  @IsString({ message: 'Postal code must be a valid text' })
  @Matches(/^\d{5}$/, {
    message: 'Postal code must be 5 digits',
  })
  postalCode: string;

  @ApiProperty({
    description: 'NPWP (Tax ID) number',
    example: '01.234.567.8-901.000',
  })
  @IsNotEmpty({ message: 'NPWP number is required' })
  @IsString({ message: 'NPWP number must be a valid text' })
  @Matches(/^\d{2}\.\d{3}\.\d{3}\.\d-\d{3}\.\d{3}$/, {
    message: 'NPWP number must be in format: XX.XXX.XXX.X-XXX.XXX',
  })
  npwpNumber: string;

  @ApiProperty({
    description: 'Business registration number',
    example: 'AHU-0012345.AH.01.01.TAHUN 2023',
  })
  @IsNotEmpty({ message: 'Business registration number is required' })
  @IsString({ message: 'Business registration number must be a valid text' })
  registrationNumber: string;

  @ApiProperty({
    description: 'Name of the company director',
    example: 'John Doe',
  })
  @IsNotEmpty({ message: 'Director name is required' })
  @IsString({ message: 'Director name must be a valid text' })
  @Transform(({ value }) => value?.trim())
  directorName: string;

  @ApiProperty({
    description: 'Position of the company director',
    example: 'CEO',
  })
  @IsNotEmpty({ message: 'Director position is required' })
  @IsString({ message: 'Director position must be a valid text' })
  @Transform(({ value }) => value?.trim())
  directorPosition: string;

  @ApiProperty({
    description: 'NPWP document storage path in format bucket:path',
    example: 'documents:institutions/13/npwp-document-1757496173043-npwp.jpg',
  })
  @IsNotEmpty({ message: 'NPWP document path is required' })
  @IsString({ message: 'NPWP document path must be a valid text' })
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'NPWP document must be in format bucket:institutions/userId/filename',
  })
  npwpDocumentPath: string;

  @ApiProperty({
    description: 'Registration document storage path in format bucket:path',
    example: 'documents:institutions/13/registration-document-1757496173043-registration.jpg',
  })
  @IsNotEmpty({ message: 'Registration document path is required' })
  @IsString({ message: 'Registration document path must be a valid text' })
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'Registration document must be in format bucket:institutions/userId/filename',
  })
  registrationDocumentPath: string;

  @ApiProperty({
    description: 'Deed of establishment document storage path in format bucket:path',
    example: 'documents:institutions/13/deed-of-establishment-1757496173043-deed.jpg',
  })
  @IsNotEmpty({ message: 'Deed of establishment path is required' })
  @IsString({ message: 'Deed of establishment path must be a valid text' })
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'Deed of establishment document must be in format bucket:institutions/userId/filename',
  })
  deedOfEstablishmentPath: string;

  @ApiProperty({
    description: 'Director ID card storage path in format bucket:path',
    example: 'documents:institutions/13/director-id-card-1757496173043-director-id.jpg',
  })
  @IsNotEmpty({ message: 'Director ID card path is required' })
  @IsString({ message: 'Director ID card path must be a valid text' })
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'Director ID card must be in format bucket:institutions/userId/filename',
  })
  directorIdCardPath: string;

  @ApiProperty({
    description: 'Ministry approval document storage path in format bucket:path',
    example: 'documents:institutions/13/ministry-approval-document-1757496173043-ministry.jpg',
  })
  @IsNotEmpty({ message: 'Ministry approval document path is required' })
  @IsString({ message: 'Ministry approval document path must be a valid text' })
  @Matches(/^[a-zA-Z0-9-_]+:institutions\/\d+\/[a-zA-Z0-9-_.]+$/, {
    message: 'Ministry approval document must be in format bucket:institutions/userId/filename',
  })
  ministryApprovalDocumentPath: string;
}

// DTO for form data submission (without file URLs - files will be uploaded separately)
export class SubmitCreateInstitutionDto extends OmitType(CreateInstitutionDto, [
  'npwpDocumentPath',
  'registrationDocumentPath',
  'deedOfEstablishmentPath',
  'directorIdCardPath',
  'ministryApprovalDocumentPath',
] as const) {}
