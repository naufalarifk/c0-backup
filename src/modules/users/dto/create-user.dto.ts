import type { UserDecidesUserTypeParams } from '../../../shared/types';

import { ApiProperty } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty } from 'class-validator';

export enum Role {
  Individual = 'Individual',
  Institution = 'Institution',
}

export class CreateUserDto {
  @ApiProperty({
    example: 'Individual',
    enum: Role,
    enumName: 'Role',
    description: 'The type of user account to create',
  })
  @IsEnum(Role, { message: 'Role must be either Individual or Institution' })
  @IsNotEmpty({ message: 'Role is required' })
  role: UserDecidesUserTypeParams['userType'];
}
