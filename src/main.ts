import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';

import { randomUUID } from 'crypto';

import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';

import { AppModule } from './app.module';
import docs from './docs';
import { GlobalExceptionFilter } from './filters';
import { ResolvePromisesInterceptor, TelemetryInterceptor } from './shared/interceptors';
import { AppConfigService } from './shared/services/app-config.service';
import { SharedModule } from './shared/shared.module';
import { validationOptions } from './shared/utils';
import { TelemetryLogger } from './telemetry.logger';

async function bootstrap() {
  const logger = new TelemetryLogger();

  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bodyParser: false,
    logger,
  });

  const reflector = app.get(Reflector);
  const configService = app.select(SharedModule).get(AppConfigService);

  app.use(
    helmet({
      contentSecurityPolicy: configService.isDevelopment
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", "'unsafe-inline'", 'https:'],
              styleSrc: ["'self'", "'unsafe-inline'", 'https:'],
              fontSrc: ["'self'", 'https:', 'data:'],
              imgSrc: ["'self'", 'https:', 'data:'],
              connectSrc: ["'self'", 'https:'],
            },
          }
        : {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
              styleSrc: ["'self'", 'https://cdn.jsdelivr.net', 'https://fonts.googleapis.com'],
              fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
              imgSrc: ["'self'", 'https:', 'data:'],
              connectSrc: ["'self'"],
              frameSrc: ["'none'"],
              objectSrc: ["'none'"],
            },
          },
    }),
  );
  app.use(compression());

  // Add request ID middleware
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
          write: (message: string) => logger.log(message.trim()),
        },
        skip(req: Request, _res) {
          const url = req.originalUrl || req.url || '';
          // Disable access logging for the healthcheck endpoint to keep logs clean
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

  // Starts listening for shutdown hooks
  if (!configService.isDevelopment) {
    app.enableShutdownHooks();
  }

  const port = configService.appConfig.port;
  await app.listen(port, async () => {
    logger.log(`Server is listening at ${await app.getUrl()}`);
    logger.log(`Current environment is: ${configService.nodeEnv}`);
  });
}
void bootstrap();
