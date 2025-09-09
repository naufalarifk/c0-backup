import type { UserViewsProfileResult } from '../shared/types';

import { Reflector } from '@nestjs/core';

export const Roles = Reflector.createDecorator<UserViewsProfileResult['role'][]>();
