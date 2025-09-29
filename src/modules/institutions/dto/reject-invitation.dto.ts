import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsOptional, IsString } from 'class-validator';

export class RejectInvitationDto {
  @ApiProperty({
    description: 'Optional reason for rejecting the invitation',
    example: 'I am not interested in joining this institution at the moment',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => value?.trim())
  reason?: string;
}
