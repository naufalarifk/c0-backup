import { ConfigurableModuleBuilder } from '@nestjs/common';

import { AUTH_MODULE_OPTIONS } from './auth.symbols';
import { AuthModuleConfig, AuthModuleFeatures } from './types';

interface ExtraOptions extends AuthModuleFeatures {
  isGlobal: boolean;
}

export const { ConfigurableModuleClass, OPTIONS_TYPE, ASYNC_OPTIONS_TYPE } =
  new ConfigurableModuleBuilder<AuthModuleConfig>({
    optionsInjectionToken: AUTH_MODULE_OPTIONS,
  })
    .setExtras<ExtraOptions>(
      {
        isGlobal: true,
        disableTrustedOriginsCors: false,
        disableBodyParser: false,
        disableGlobalAuthGuard: false,
        disableExceptionFilter: false,
      },
      (def, extras) => {
        return {
          ...def,
          exports: [AUTH_MODULE_OPTIONS],
          global: extras.isGlobal,
        };
      },
    )
    .setClassMethodName('forRoot')
    .setFactoryMethodName('createAuthConfig')
    .build();
