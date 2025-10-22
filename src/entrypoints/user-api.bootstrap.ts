import { randomUUID } from 'node:crypto';
import Stream from 'node:stream';

import { ClassSerializerInterceptor, ValidationPipe } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { WsAdapter } from '@nestjs/platform-ws';

import compression from 'compression';
import cookieParser from 'cookie-parser';
import { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';

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

  app.use(function (req: Request, res: Response, next: NextFunction) {
    const requestId = req.get('x-request-id') || req.get('request-id') || randomUUID();
    req.headers['x-request-id'] = requestId;
    res.set('x-request-id', requestId);
    next();
  });

  app.use(function (req: Request, res: Response, next: NextFunction) {
    const chunks: Buffer[] = [];

    const originalWrite = res.write;
    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else {
          chunks.push(Buffer.from(chunk));
        }
      }
      return originalWrite.apply(this, [chunk, ...args]);
    };

    const originalEnd = res.end;
    res.end = function (chunk?: any, ...args: any[]): Response {
      if (chunk) {
        if (Buffer.isBuffer(chunk)) {
          chunks.push(chunk);
        } else {
          chunks.push(Buffer.from(chunk));
        }
      }
      return originalEnd.apply(this, [chunk, ...args]);
    };

    res.addListener('finish', function () {
      let responseBody = '[Empty]';

      if (chunks.length > 0) {
        const buffer = Buffer.concat(chunks);
        const contentType = res.getHeader('content-type');

        if (
          contentType &&
          typeof contentType === 'string' &&
          contentType.includes('application/octet-stream')
        ) {
          responseBody = `[Binary Data: ${buffer.length} bytes]`;
        } else if (buffer.length > 10000) {
          responseBody = `[Large Response: ${buffer.length} bytes]`;
        } else {
          try {
            responseBody = buffer.toString('utf8');
          } catch {
            responseBody = `[Binary Data: ${buffer.length} bytes]`;
          }
        }
      }

      // logger.log(`${req.headers['x-request-id']} ${req.method} ${req.originalUrl}`);
      // logger.log(`${req.headers['x-request-id']} ${res.statusCode}`);
      // logger.log(`${req.headers['x-request-id']} ${JSON.stringify({ ...req.headers })}`);
      // logger.log(`${req.headers['x-request-id']} ${responseBody}`);
    });

    next();
  });

  app.setGlobalPrefix('api');
  app.enableVersioning();

  app.useGlobalFilters(new GlobalExceptionFilter());

  app.useGlobalInterceptors(
    app.get(TelemetryInterceptor),
    new ResolvePromisesInterceptor(),
    new ClassSerializerInterceptor(reflector),
  );

  app.useGlobalPipes(new ValidationPipe(validationOptions));
  app.useWebSocketAdapter(new WsAdapter(app));

  if (configService.documentationEnabled) {
    await docs(app, configService.authConfig.url);
  }

  if (!configService.isDevelopment) {
    app.enableShutdownHooks();
  }

  const port = configService.app.port;
  await app.listen(port, async function () {
    logger.log(`Server is listening at ${await app.getUrl()}`);
    logger.log(`Current environment is: ${configService.nodeEnv}`);
  });
}
