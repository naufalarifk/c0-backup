import { ApiProperty } from '@nestjs/swagger';

import { IsOptional, IsString } from 'class-validator';

export class UpdatePushTokenDto {
  @ApiProperty({
    description: 'Push notification token (without ExponentPushToken prefix)',
    example: 'xxxxxxxxxxxxxxxxxxxxxx',
    required: false,
  })
  @IsOptional()
  @IsString()
  pushToken?: string;
}
