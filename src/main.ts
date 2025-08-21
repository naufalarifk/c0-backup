import type { NestExpressApplication } from '@nestjs/platform-express';

import {
  ClassSerializerInterceptor,
  HttpStatus,
  Logger,
  UnprocessableEntityException,
  ValidationPipe,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import compression from 'compression';
import helmet from 'helmet';
import morgan from 'morgan';

import { AppModule } from './app.module';
import { docs } from './lib';
import { ConfigService } from './shared/services/config.service';
import { SharedModule } from './shared/shared.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, new ExpressAdapter(), {
    bodyParser: false,
  });

  const reflector = app.get(Reflector);
  const logger = new Logger(bootstrap.name);
  const configService = app.select(SharedModule).get(ConfigService);

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
  app.use(morgan('combined'));

  app.setGlobalPrefix('api');
  app.enableVersioning();

  app.useGlobalInterceptors(new ClassSerializerInterceptor(reflector));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      transform: true,
      dismissDefaultMessages: true,
      forbidNonWhitelisted: true,
      exceptionFactory: errors => new UnprocessableEntityException(errors),
    }),
  );

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
