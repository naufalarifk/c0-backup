import { ApiProperty } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum InvitationStatus {
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

export class UpdateInvitationStatusDto {
  @ApiProperty({
    enum: InvitationStatus,
    description: 'Status of the invitation',
    example: InvitationStatus.ACCEPTED,
  })
  @IsNotEmpty()
  @IsEnum(InvitationStatus)
  status: InvitationStatus;

  @ApiProperty({
    description: 'Reason for rejection (optional, only for rejected status)',
    example: 'Not interested in this role',
    required: false,
  })
  @IsOptional()
  @IsString()
  reason?: string;
}
