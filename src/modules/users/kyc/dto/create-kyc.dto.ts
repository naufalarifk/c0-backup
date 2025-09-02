import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum IdentityType {
  KTP = 'KTP',
  PASSPORT = 'PASSPORT',
  SIM = 'SIM',
}

export class CreateKycDto {
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @IsString()
  @IsNotEmpty()
  identityNumber: string;

  @IsEnum(IdentityType)
  identityType: IdentityType;

  @IsString()
  @IsNotEmpty()
  address: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  occupation?: string;
}
