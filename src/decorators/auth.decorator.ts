import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiForbiddenResponse, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { Optional, Public } from '../modules/auth/auth.decorator';
import { AuthGuard } from '../modules/auth/auth.guard';
import { UserViewsProfileResult } from '../shared/types';
import { Roles } from './roles.decorator';

interface AuthOptions {
  roles?: UserViewsProfileResult['role'][];
  optional?: boolean;
  public?: boolean;
}

/**
 * Unified authentication and authorization decorator
 *
 * @param rolesOrOptions - Array of roles or options object
 *
 * @example
 * // Require Admin role
 * @Auth(['Admin'])
 *
 * // Optional authentication (can access session if available)
 * @Auth({ optional: true })
 *
 * // Public endpoint (no authentication)
 * @Auth({ public: true })
 *
 * // Any authenticated user
 * @Auth()
 */
export function Auth(rolesOrOptions: UserViewsProfileResult['role'][] | AuthOptions = []) {
  let roles: UserViewsProfileResult['role'][] = [];
  let optional = false;
  let isPublic = false;

  // Handle both old and new syntax
  if (Array.isArray(rolesOrOptions)) {
    roles = rolesOrOptions;
  } else {
    roles = rolesOrOptions.roles || [];
    optional = rolesOrOptions.optional || false;
    isPublic = rolesOrOptions.public || false;
  }

  // Public endpoints don't need any guards
  if (isPublic) {
    return applyDecorators(Public());
  }

  const decorators = [Roles(roles), UseGuards(AuthGuard)];

  if (optional) {
    decorators.unshift(Optional());
  }

  if (!optional) {
    decorators.push(
      ApiUnauthorizedResponse({ description: 'Authentication required - No valid session found' }),
      ApiForbiddenResponse({
        description: 'Insufficient permissions - User role does not have access',
      }),
    );
  }

  return applyDecorators(...decorators);
}
