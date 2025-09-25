import { ApiProperty } from '@nestjs/swagger';

import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @ApiProperty({
    required: false,
    description: 'User name',
    maxLength: 160,
  })
  @IsString()
  @MaxLength(160, { message: 'Name must be at most 160 characters long' })
  @IsOptional()
  name?: string;
}
