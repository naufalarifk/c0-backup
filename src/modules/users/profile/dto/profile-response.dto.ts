import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

import { UserViewsProfileResult } from '../../../../shared/types';

export class ProfileResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 123,
  })
  id: number;

  @ApiProperty({
    description: 'User full name',
    example: 'John Doe',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'User email address',
    example: 'john.doe@example.com',
    required: false,
  })
  email?: string;

  @ApiProperty({
    description: 'Email verification status',
    example: true,
  })
  emailVerified: boolean;

  @ApiProperty({
    description: 'Profile picture URL',
    example: 'https://example.com/profile.jpg',
    required: false,
  })
  profilePicture?: string;

  @ApiProperty({
    description: 'User role in the system',
    enum: ['System', 'Admin', 'User'],
    example: 'User',
  })
  role: UserViewsProfileResult['role'];

  @ApiProperty({
    description: 'Two-factor authentication status',
    example: false,
  })
  twoFactorEnabled: boolean;

  @ApiProperty({
    description: 'Account creation date',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @Type(() => Date)
  createdAt?: Date;

  @ApiProperty({
    description: 'Last update date',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @Type(() => Date)
  updatedAt?: Date;

  @ApiProperty({
    description: 'User account type',
    enum: ['Undecided', 'Individual', 'Institution'],
    example: 'Individual',
  })
  userType: 'Undecided' | 'Individual' | 'Institution';

  @ApiProperty({
    description: 'Date when user type was selected',
    example: '2024-01-01T00:00:00.000Z',
    required: false,
  })
  @Type(() => Date)
  userTypeSelectedDate?: Date;

  @ApiProperty({
    description: 'Institution user ID if user belongs to an institution',
    example: 'institution-456',
    required: false,
    nullable: true,
  })
  institutionUserId?: string | null;

  @ApiProperty({
    description: 'Role within the institution',
    enum: ['Owner', 'Finance'],
    example: 'Finance',
    required: false,
    nullable: true,
  })
  institutionRole?: 'Owner' | 'Finance' | null;

  @ApiProperty({
    description: 'KYC record ID if submitted',
    example: 'kyc-789',
    required: false,
    nullable: true,
  })
  kycId?: string | null;

  @ApiProperty({
    description: 'KYC verification status',
    enum: ['none', 'pending', 'verified', 'rejected'],
    example: 'verified',
  })
  kycStatus: 'none' | 'pending' | 'verified' | 'rejected';

  @ApiProperty({
    description: 'Business name for institution users',
    example: 'ACME Corporation',
    required: false,
    nullable: true,
  })
  businessName?: string | null;

  @ApiProperty({
    description: 'Business type for institution users',
    example: 'Technology',
    required: false,
    nullable: true,
  })
  businessType?: string | null;
}
