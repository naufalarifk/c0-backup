import type { UserDecidesUserTypeParams } from '../../../shared/types';

import { ApiProperty } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty } from 'class-validator';

export enum AccountType {
  Individual = 'Individual',
  Institution = 'Institution',
}

export class CreateUserDto {
  @ApiProperty({
    example: 'Individual',
    enum: AccountType,
    enumName: 'AccountType',
    description: 'The type of user account to create',
  })
  @IsEnum(AccountType, { message: 'userType must be either Individual or Institution' })
  @IsNotEmpty({ message: 'userType is required' })
  userType: UserDecidesUserTypeParams['userType'];
}
