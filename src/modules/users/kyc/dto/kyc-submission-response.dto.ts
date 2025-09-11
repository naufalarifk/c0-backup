import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class KycSubmissionResponseDto {
  @ApiProperty({
    description: 'KYC record ID',
    example: 'kyc-789',
  })
  id: string;

  @ApiProperty({
    description: 'User ID',
    example: 'user-456',
  })
  userId: string;

  @ApiProperty({
    description: 'Name from KYC submission',
    example: 'John Doe',
  })
  name: string;

  @ApiProperty({
    description: 'National Identity Number (NIK)',
    example: '1234567890123456',
  })
  nik: string;

  @ApiProperty({
    description: 'KYC submission timestamp',
    example: '2024-01-01T10:00:00.000Z',
  })
  @Type(() => Date)
  submissionDate: Date;

  @ApiProperty({
    description: 'Initial status after submission',
    enum: ['pending'],
    example: 'pending',
  })
  status: 'pending';
}
