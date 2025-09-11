import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

import { OwnerUserInvitesUserToInstitutionParams } from '../../../shared/types';

export enum InvitationRole {
  OWNER = 'Owner',
  FINANCE = 'Finance',
}

export class CreateInstitutionInviteDto
  implements Omit<OwnerUserInvitesUserToInstitutionParams, 'invitationDate'>
{
  @ApiProperty({
    description: 'The ID of the institution',
    example: 'inst_123456789',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  institutionId: string;

  @ApiProperty({
    description: 'The ID of the user to invite',
    example: 'user_123456789',
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  userId: string;

  @ApiProperty({
    description: 'The role to assign to the invited user',
    enum: InvitationRole,
    example: 'Finance',
  })
  @IsNotEmpty()
  @IsEnum(InvitationRole)
  role: InvitationRole;
}
