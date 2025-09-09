import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Auth } from 'better-auth';
import type { Request } from 'express';
import type { UserViewsProfileResult } from '../../shared/types';

import { ForbiddenException, Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { fromNodeHeaders } from 'better-auth/node';

import { Roles } from '../../decorators/roles.decorator';
import { Optional, Public } from './auth.decorator';
import { AUTH_INSTANCE_KEY } from './auth.symbols';

/**
 * NestJS guard that handles authentication and authorization for protected routes
 * Can be configured with @Public() or @Optional() decorators to modify authentication behavior
 * Also handles role-based access control via @Roles() decorator
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector)
    private readonly reflector: Reflector,
    @Inject(AUTH_INSTANCE_KEY)
    private readonly auth: Auth,
  ) {}

  /**
   * Validates if the current request is authenticated and authorized
   * Attaches session and user information to the request object
   * @param context - The execution context of the current request
   * @returns True if the request is authorized to proceed, throws an error otherwise
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const session = await this.auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    request.session = session;
    request.user = session?.user ?? null; // useful for observability tools like Sentry

    const isPublic = this.reflector.getAllAndOverride(Public, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const isOptional = this.reflector.getAllAndOverride<boolean>(Optional, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Handle authentication
    if (isOptional && !session) {
      return true; // Allow access without authentication for optional routes
    }

    if (!session) {
      throw new UnauthorizedException('Authentication required');
    }

    // Handle authorization (role checking)
    const requiredRoles = this.reflector.getAllAndOverride(Roles, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles?.length) {
      return true; // No specific roles required
    }

    const user = session.user as { role?: UserViewsProfileResult['role'] };

    if (!user?.role || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('Insufficient permissions');
    }

    return true;
  }
}
