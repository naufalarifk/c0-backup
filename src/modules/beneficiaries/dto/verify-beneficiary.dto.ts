import { ApiProperty } from '@nestjs/swagger';

import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class VerifyBeneficiaryDto {
  @ApiProperty({
    description: 'Verification token received via email',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  @IsString()
  @IsNotEmpty({ message: 'Verification token is required' })
  token: string;

  @ApiProperty({
    description: 'Optional callback URL to redirect after verification',
    example: '/withdrawal',
    required: false,
  })
  @IsOptional()
  @IsString()
  callbackURL?: string;
}
