import type { AuthModuleConfig, ExtendedAuth } from './types';

import { Inject } from '@nestjs/common';

import { AUTH_MODULE_OPTIONS } from './auth.symbols';

/**
 * NestJS service that provides access to the Better Auth instance
 * Use generics to support auth instances extended by plugins
 */
export class AuthService<T extends ExtendedAuth = ExtendedAuth> {
  constructor(
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleConfig,
  ) {}

  /**
   * Returns the API endpoints provided by the auth instance
   */
  get api(): T['api'] {
    return this.options.auth.api;
  }

  /**
   * Returns the complete auth instance
   * Access this for plugin-specific functionality
   */
  get instance(): T {
    return this.options.auth as T;
  }
}
