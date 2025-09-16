import type { getSession } from 'better-auth/api';

import { sso } from '@better-auth/sso';
import { betterAuth } from 'better-auth';
import { customSession, multiSession, openAPI, phoneNumber, twoFactor } from 'better-auth/plugins';

/**
 * Type representing a valid user session after authentication
 * Excludes null and undefined values from the session return type
 */
export type UserSession = NonNullable<Awaited<ReturnType<ReturnType<typeof getSession>>>>;

export type AuthInstance = ReturnType<typeof betterAuth>;

export type PluginEndpoints = ReturnType<typeof twoFactor>['endpoints'] &
  ReturnType<typeof phoneNumber>['endpoints'] &
  ReturnType<typeof sso>['endpoints'] &
  ReturnType<typeof multiSession>['endpoints'] &
  ReturnType<typeof customSession>['endpoints'] &
  ReturnType<typeof openAPI>['endpoints'];

export interface ExtendedAuth extends AuthInstance {
  api: AuthInstance['api'] & PluginEndpoints;
}
