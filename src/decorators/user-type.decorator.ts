import { applyDecorators, UseGuards } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { UserTypeGuard } from '../guards';

export const UserType = Reflector.createDecorator<'Individual' | 'Institution'>();

export function RequireUserType(userType: 'Individual' | 'Institution') {
  return applyDecorators(UserType(userType), UseGuards(UserTypeGuard));
}
