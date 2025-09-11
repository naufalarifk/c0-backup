import { ApiProperty } from '@nestjs/swagger';

import { Type } from 'class-transformer';

export class UpdateProfileResponseDto {
  @ApiProperty({
    description: 'User ID',
    example: 'user-123',
  })
  id: string;

  @ApiProperty({
    description: 'Updated full name',
    example: 'John Updated Doe',
    required: false,
  })
  name?: string;

  @ApiProperty({
    description: 'Updated profile picture URL',
    example: 'https://example.com/new-profile.jpg',
    required: false,
    nullable: true,
  })
  profilePictureUrl?: string | null;

  @ApiProperty({
    description: 'Profile update timestamp',
    example: '2024-01-01T12:00:00.000Z',
  })
  @Type(() => Date)
  updatedDate: Date;
}
