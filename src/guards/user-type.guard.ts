import type { Auth } from 'better-auth';
import type { Request } from 'express';

import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { fromNodeHeaders } from 'better-auth/node';

import { UserType } from '../decorators/user-type.decorator';
import { AUTH_INSTANCE_KEY } from '../modules/auth/auth.symbols';
import { CryptogadaiRepository } from '../shared/repositories/cryptogadai.repository';

@Injectable()
export class UserTypeGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AUTH_INSTANCE_KEY)
    private readonly auth: Auth,
    private readonly userRepo: CryptogadaiRepository,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    const requiredUserType = this.reflector.getAllAndOverride(UserType, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no user type is specified, skip this guard (let other guards handle it)
    if (!requiredUserType) {
      return true;
    }

    const userId = session?.user.id;
    if (!userId) {
      throw new ForbiddenException('User not authenticated');
    }

    // Get user profile to check user type
    const userProfile = await this.userRepo.userViewsProfile({ userId });

    if (userProfile.userType === 'Undecided') {
      throw new ForbiddenException(
        'Please select your user type first (Individual or Institution) to access this feature.',
      );
    }

    // Check if user has the required type
    if (userProfile.userType !== requiredUserType) {
      throw new ForbiddenException(
        `Access denied. This endpoint requires ${requiredUserType} user type.`,
      );
    }

    return true;
  }
}
