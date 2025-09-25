import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export enum InvitationRole {
  OWNER = 'Owner',
  FINANCE = 'Finance',
}

export class CreateInstitutionInviteDto {
  @ApiProperty({
    description: 'The email of the user to invite',
    example: 'user@example.com',
    maxLength: 254,
  })
  @IsNotEmpty()
  @IsEmail()
  @MaxLength(254, { message: 'Email address is too long (maximum 254 characters)' })
  @Transform(({ value }) => value?.trim().toLowerCase())
  userEmail: string;

  @ApiProperty({
    description: 'The role to assign to the invited user',
    enum: InvitationRole,
    example: 'Finance',
  })
  @IsNotEmpty()
  @IsEnum(InvitationRole)
  role: InvitationRole;

  @ApiProperty({
    description: 'Optional invitation message',
    example: 'We would like to invite you to join our institution',
    required: false,
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Message is too long (maximum 1000 characters)' })
  @Transform(({ value }) => value?.trim())
  message?: string;
}
