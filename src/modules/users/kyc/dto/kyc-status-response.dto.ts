import { ApiProperty } from '@nestjs/swagger';

export class KycSubmissionDto {
  @ApiProperty({
    description: 'KYC submission ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'KYC verification status',
    enum: ['pending', 'verified', 'rejected'],
    example: 'pending',
  })
  status: 'pending' | 'verified' | 'rejected';

  @ApiProperty({
    description: 'KYC submission date (ISO string)',
    example: '2024-01-01T10:00:00.000Z',
  })
  submittedDate: string;

  @ApiProperty({
    description: 'KYC verification date (ISO string)',
    example: '2024-01-02T15:30:00.000Z',
    required: false,
  })
  verifiedDate?: string | null;

  @ApiProperty({
    description: 'KYC rejection date (ISO string)',
    example: '2024-01-02T15:30:00.000Z',
    required: false,
  })
  rejectedDate?: string | null;

  @ApiProperty({
    description: 'Reason for rejection (if rejected)',
    example: 'Document not clear, please resubmit with better quality photos',
    required: false,
  })
  rejectionReason?: string | null;
}

export class KycStatusResponseDto {
  @ApiProperty({
    description: 'KYC verification status',
    enum: ['none', 'pending', 'verified', 'rejected'],
    example: 'pending',
  })
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';

  @ApiProperty({
    description: 'KYC submission details (null if no submission)',
    type: KycSubmissionDto,
    required: false,
  })
  submission: KycSubmissionDto | null;

  @ApiProperty({
    description: 'Whether user can resubmit KYC',
    example: false,
  })
  canResubmit: boolean;
}
