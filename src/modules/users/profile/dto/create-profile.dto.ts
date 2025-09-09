import { ApiProperty } from '@nestjs/swagger';

import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateProfileDto {
  @ApiProperty({
    description: 'Name of the user',
    example: 'John Doe',
    required: false,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  @Matches(/^[a-zA-Z\s.''-]+$/, {
    message: 'Name can only contain letters, spaces, apostrophes, periods, and hyphens',
  })
  name?: string;
}
