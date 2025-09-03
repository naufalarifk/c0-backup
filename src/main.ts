import './tracing';

import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';

import { ClassSerializerInterceptor, Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';

import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';

import { AppModule } from './app.module';
import docs from './docs';
import { GlobalExceptionFilter } from './shared/filters';
import { ResolvePromisesInterceptor, TelemetryInterceptor } from './shared/interceptors';
import { AppConfigService } from './shared/services/app-config.service';
import { TelemetryService } from './shared/services/telemetry.service';
import { SharedModule } from './shared/shared.module';
import validationOptions from './shared/utils/validation-options';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bodyParser: false,
  });

  const reflector = app.get(Reflector);
  const logger = new Logger(bootstrap.name);
  const configService = app.select(SharedModule).get(AppConfigService);
  const telemetryService = app.select(SharedModule).get(TelemetryService);

  app.enableCors({
    origin: configService.appConfig.allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  });

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
  app.use(
    morgan('combined', {
      skip(req: Request, _res) {
        const url = req.originalUrl || req.url || '';
        // Disable access logging for the healthcheck endpoint to keep logs clean
        return /^(\/api)?\/health(\/|$)/.test(url);
      },
    }),
  );

  app.setGlobalPrefix('api');
  app.enableVersioning();

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalInterceptors(
    new TelemetryInterceptor(telemetryService),
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(reflector),
  );

  app.useGlobalPipes(new ValidationPipe(validationOptions));

  if (configService.documentationEnabled) {
    await docs(app);
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
