import { ApiProperty } from '@nestjs/swagger';

import { IsOptional, IsString, IsUrl, Matches, MaxLength } from 'class-validator';

import { UserUpdatesProfileParams } from '../../../../shared/types';

export class CreateProfileDto implements Omit<UserUpdatesProfileParams, 'id' | 'updateDate'> {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Full name must not exceed 255 characters' })
  @Matches(/^[a-zA-Z\s.''-]+$/, {
    message: 'Full name can only contain letters, spaces, apostrophes, periods, and hyphens',
  })
  fullName?: string;

  @ApiProperty({
    description: 'URL of the user profile picture (must be HTTPS)',
    example: 'https://example.com/profile-picture.jpg',
    required: false,
  })
  @IsOptional()
  @IsString()
  @IsUrl(
    {
      protocols: ['https'], // Only allow HTTPS URLs for security
      require_protocol: true,
    },
    { message: 'Profile picture URL must be a valid HTTPS URL' },
  )
  @MaxLength(500, { message: 'Profile picture URL must not exceed 500 characters' })
  profilePictureUrl?: string;
}
