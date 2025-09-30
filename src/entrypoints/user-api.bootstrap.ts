import { randomUUID } from 'node:crypto';

import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import { Request } from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import docs from '../docs';
import { GlobalExceptionFilter } from '../filters';
import { ResolvePromisesInterceptor, TelemetryInterceptor } from '../shared/interceptors';
import { AppConfigService } from '../shared/services/app-config.service';
import { SharedModule } from '../shared/shared.module';
import { TelemetryLogger } from '../shared/telemetry.logger';
import { validationOptions } from '../shared/utils';

export async function bootstrapUserApi(app: NestExpressApplication) {
  const logger = new TelemetryLogger('UserApi');

  const reflector = app.get(Reflector);
  const configService = app.select(SharedModule).get(AppConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://cdn.jsdelivr.net'],
          imgSrc: ["'self'", 'data:', 'https:'],
          fontSrc: ["'self'", 'https:', 'data:'],
          connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        },
      },
    }),
  );
  app.use(compression());
  app.use(cookieParser());

  app.use((req: Request, res, next) => {
    const requestId = req.get('x-request-id') || req.get('request-id') || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.set('x-request-id', requestId);
    next();
  });

  app.use(
    morgan(
      ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :req[x-request-id] - :response-time ms',
      {
        stream: {
          write(message: string) {
            logger.log(message.trim());
          },
        },
        skip(req: Request) {
          const url = req.originalUrl || req.url || '';
          return /^(\/api)?\/health(\/|$)/.test(url);
        },
      },
    ),
  );

  app.setGlobalPrefix('api');
  app.enableVersioning();

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalInterceptors(
    app.get(TelemetryInterceptor),
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(reflector),
  );

  app.useGlobalPipes(new ValidationPipe(validationOptions));

  if (configService.documentationEnabled) {
    await docs(app, configService.authConfig.url);
  }

  if (!configService.isDevelopment) {
    app.enableShutdownHooks();
  }

  const port = configService.appConfig.port;
  await app.listen(port, async () => {
    logger.log(`Server is listening at ${await app.getUrl()}`);
    logger.log(`Current environment is: ${configService.nodeEnv}`);
  });
}
