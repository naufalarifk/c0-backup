import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class KycStatusResponseDto {
  @ApiProperty({
    description: 'KYC record ID (if exists)',
    example: 'kyc-123',
    required: false,
  })
  id: string;

  @ApiProperty({
    description: 'KYC verification status',
    enum: ['none', 'pending', 'verified', 'rejected'],
    example: 'pending',
  })
  status: 'none' | 'pending' | 'verified' | 'rejected';

  @ApiProperty({
    description: 'KYC submission date',
    example: '2024-01-01T10:00:00.000Z',
    required: false,
  })
  @Type(() => Date)
  submittedDate?: Date;

  @ApiProperty({
    description: 'KYC verification date',
    example: '2024-01-02T15:30:00.000Z',
    required: false,
  })
  @Type(() => Date)
  verifiedDate?: Date;

  @ApiProperty({
    description: 'KYC rejection date',
    example: '2024-01-02T15:30:00.000Z',
    required: false,
  })
  @Type(() => Date)
  rejectedDate?: Date;

  @ApiProperty({
    description: 'Reason for rejection (if rejected)',
    example: 'Document not clear, please resubmit with better quality photos',
    required: false,
  })
  rejectionReason?: string;

  @ApiProperty({
    description: 'Whether user can resubmit KYC',
    example: false,
  })
  canResubmit: boolean;
}
