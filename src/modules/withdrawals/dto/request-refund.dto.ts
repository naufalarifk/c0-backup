import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RequestRefundDto {
  @ApiProperty({
    description: 'Reason for requesting a refund',
    example:
      'Transaction failed due to insufficient gas. Network congestion caused gas estimation to be inaccurate.',
    minLength: 10,
  })
  @IsNotEmpty({ message: 'Reason is required' })
  @IsString({ message: 'Reason must be a valid text' })
  @MinLength(10, { message: 'Reason must be at least 10 characters long' })
  @Transform(({ value }) => value?.trim())
  reason: string;
}
