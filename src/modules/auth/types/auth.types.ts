import type { getSession } from 'better-auth/api';
import type {
  SessionWithImpersonatedBy,
  UserWithPhoneNumber,
  UserWithRole,
  UserWithTwoFactor,
} from 'better-auth/plugins';

import { sso } from '@better-auth/sso';
import { betterAuth } from 'better-auth';
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

export type AuthInstance = ReturnType<typeof betterAuth>;

export type PluginEndpoints = ReturnType<typeof twoFactor>['endpoints'] &
  ReturnType<typeof phoneNumber>['endpoints'] &
  ReturnType<typeof admin>['endpoints'] &
  ReturnType<typeof sso>['endpoints'] &
  ReturnType<typeof multiSession>['endpoints'] &
  ReturnType<typeof customSession>['endpoints'] &
  ReturnType<typeof openAPI>['endpoints'];

export interface ExtendedAuth extends AuthInstance {
  api: AuthInstance['api'] & PluginEndpoints;
}
