import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

import { UserAppliesForInstitutionParams } from '../../../shared/types';

export class CreateInstitutionDto
  implements Omit<UserAppliesForInstitutionParams, 'applicantUserId' | 'applicationDate'>
{
  @ApiProperty({
    description: 'Name of the business/institution',
    example: 'PT. Teknologi Finansial Indonesia',
    minLength: 1,
    maxLength: 255,
  })
  @IsNotEmpty()
  @IsString()
  @Transform(({ value }) => value?.trim())
  businessName: string;
}
