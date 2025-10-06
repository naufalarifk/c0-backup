import type { getSession } from 'better-auth/api';
import type {
  AdminOptions,
  SessionWithImpersonatedBy,
  UserWithPhoneNumber,
  UserWithRole,
  UserWithTwoFactor,
} from 'better-auth/plugins';

import { sso } from '@better-auth/sso';
import { Auth } from 'better-auth';
import {
  admin,
  customSession,
  multiSession,
  openAPI,
  phoneNumber,
  twoFactor,
} from 'better-auth/plugins';

type Session = NonNullable<Awaited<ReturnType<ReturnType<typeof getSession>>>>;

/**
 * Type representing a valid user session after authentication
 * Excludes null and undefined values from the session return type
 */
export interface UserSession extends Session {
  user: Session['user'] & UserWithTwoFactor & UserWithPhoneNumber & UserWithRole;
  session: Session['session'] & SessionWithImpersonatedBy;
}

export type PluginEndpoints = ReturnType<typeof twoFactor>['endpoints'] &
  ReturnType<typeof phoneNumber>['endpoints'] &
  ReturnType<typeof admin<AdminOptions>>['endpoints'] &
  ReturnType<typeof sso>['endpoints'] &
  ReturnType<typeof multiSession>['endpoints'] &
  ReturnType<typeof customSession>['endpoints'] &
  ReturnType<typeof openAPI>['endpoints'];

export interface ExtendedAuth extends Auth {
  api: Auth['api'] & PluginEndpoints;
}

export type AuthModuleFeatures = {
  disableExceptionFilter: boolean;
  disableGlobalAuthGuard: boolean;
  disableTrustedOriginsCors: boolean;
  disableBodyParser: boolean;
};

export interface AuthModuleConfig<T extends ExtendedAuth = ExtendedAuth>
  extends AuthModuleFeatures {
  auth: T;
}
