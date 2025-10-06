import type { DynamicModule, MiddlewareConsumer, NestModule, OnModuleInit } from '@nestjs/common';
import type { Application } from 'express';
import type { AuthModuleConfig } from './types';

import { Inject, Module } from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  DiscoveryModule,
  DiscoveryService,
  HttpAdapterHost,
  MetadataScanner,
} from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

import { toNodeHandler } from 'better-auth/node';
import { createAuthMiddleware } from 'better-auth/plugins';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { AfterHook, BeforeHook, Hook } from './auth.decorator';
import { AuthFilter } from './auth.filter';
import { AuthGuard } from './auth.guard';
import { AuthMiddleware } from './auth.middleware';
import {
  ASYNC_OPTIONS_TYPE,
  ConfigurableModuleClass,
  OPTIONS_TYPE,
} from './auth.module-definition';
import { AuthService } from './auth.service';
import { AUTH_MODULE_OPTIONS } from './auth.symbols';

const HOOKS = [
  { metadataKey: BeforeHook.KEY, hookType: 'before' as const },
  { metadataKey: AfterHook.KEY, hookType: 'after' as const },
];

/**
 * NestJS module that integrates the Auth library with NestJS applications.
 * Provides authentication middleware, hooks, and exception handling.
 */
@Module({
  imports: [DiscoveryModule],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule extends ConfigurableModuleClass implements NestModule, OnModuleInit {
  private readonly logger = new TelemetryLogger(AuthModule.name);

  constructor(
    @Inject(DiscoveryService)
    private readonly discoveryService: DiscoveryService,
    @Inject(MetadataScanner)
    private readonly metadataScanner: MetadataScanner,
    @Inject(HttpAdapterHost)
    private readonly adapter: HttpAdapterHost<ExpressAdapter>,
    @Inject(AUTH_MODULE_OPTIONS)
    private readonly options: AuthModuleConfig,
  ) {
    super();
  }

  configure(consumer: MiddlewareConsumer) {
    const trustedOrigins = this.options.auth.options.trustedOrigins;
    // function-based trustedOrigins requires a Request (from web-apis) object to evaluate, which is not available in NestJS (we only have a express Request object)
    // if we ever need this, take a look at better-call which show an implementation for this
    const isNotFunctionBased = trustedOrigins && Array.isArray(trustedOrigins);

    if (!this.options.disableTrustedOriginsCors && isNotFunctionBased) {
      this.adapter.httpAdapter.enableCors({
        origin: trustedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true,
      });
    } else if (trustedOrigins && !this.options.disableTrustedOriginsCors && !isNotFunctionBased)
      throw new Error(
        'Function-based trustedOrigins not supported in NestJS. Use string array or disable CORS with disableTrustedOriginsCors: true.',
      );

    if (!this.options.disableBodyParser) consumer.apply(AuthMiddleware).forRoutes('*path');

    // Get basePath from options or use default
    let basePath = this.options.auth.options.basePath ?? '/api/auth';

    // Ensure basePath starts with /
    if (!basePath.startsWith('/')) {
      basePath = `/${basePath}`;
    }

    // Ensure basePath doesn't end with /
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }

    const handler = toNodeHandler(this.options.auth);
    this.adapter.httpAdapter
      .getInstance<Application>()
      // little hack to ignore any global prefix
      // for now i'll just not support a global prefix
      .use(`${basePath}/*path`, (req, res) => {
        return handler(req, res);
      });
    this.logger.log(`AuthModule initialized BetterAuth on '${basePath}/*'`);
  }

  onModuleInit() {
    const providers = this.discoveryService
      .getProviders()
      .filter(({ metatype }) => metatype && Reflect.getMetadata(Hook.KEY, metatype));

    const hasHookProviders = providers.length > 0;
    const hooksConfigured = typeof this.options.auth?.options?.hooks === 'object';

    if (hasHookProviders && !hooksConfigured)
      throw new Error(
        "Detected @Hook providers but Better Auth 'hooks' are not configured. Add 'hooks: {}' to your betterAuth(...) options.",
      );

    if (!hooksConfigured) return;

    for (const provider of providers) {
      const providerPrototype = Object.getPrototypeOf(provider.instance);
      const methods = this.metadataScanner.getAllMethodNames(providerPrototype);

      for (const method of methods) {
        const providerMethod = providerPrototype[method];
        this.setupHooks(providerMethod, provider.instance);
      }
    }
  }

  private setupHooks(
    providerMethod: (...args: unknown[]) => unknown,
    providerClass: { new (...args: unknown[]): unknown },
  ) {
    if (!this.options.auth.options.hooks) return;

    for (const { metadataKey, hookType } of HOOKS) {
      const hasHook = Reflect.hasMetadata(metadataKey, providerMethod);
      if (!hasHook) continue;

      const hookPath = Reflect.getMetadata(metadataKey, providerMethod);

      const originalHook = this.options.auth.options.hooks[hookType];
      this.options.auth.options.hooks[hookType] = createAuthMiddleware(async ctx => {
        if (originalHook) {
          await originalHook(ctx);
        }

        if (hookPath && hookPath !== ctx.path) return;

        await providerMethod.apply(providerClass, [ctx]);
      });
    }
  }

  /**
   * Static factory method to create and configure the AuthModule.
   * @param auth - The Auth instance to use
   * @param options - Configuration options for the module
   */
  static forRoot(options: typeof OPTIONS_TYPE): DynamicModule {
    const forRootResult = super.forRoot(options);

    return {
      ...forRootResult,
      providers: [
        ...(forRootResult.providers ?? []),
        ...(!options.disableGlobalAuthGuard ? [{ provide: APP_GUARD, useClass: AuthGuard }] : []),
        ...(!options.disableExceptionFilter ? [{ provide: APP_FILTER, useClass: AuthFilter }] : []),
      ],
    };
  }

  /**
   * Static factory method to create and configure the AuthModule asynchronously.
   * @param options - Async configuration options for the module
   */
  static forRootAsync(options: typeof ASYNC_OPTIONS_TYPE): DynamicModule {
    const forRootAsyncResult = super.forRootAsync(options);

    return {
      ...forRootAsyncResult,
      providers: [
        ...(forRootAsyncResult.providers ?? []),
        ...(!options.disableGlobalAuthGuard ? [{ provide: APP_GUARD, useClass: AuthGuard }] : []),
        ...(!options.disableExceptionFilter ? [{ provide: APP_FILTER, useClass: AuthFilter }] : []),
      ],
    };
  }
}
