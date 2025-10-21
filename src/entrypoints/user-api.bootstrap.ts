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
    let responseBody = '';

    const originalWrite = res.write;

    res.write = function (chunk: any, ...args: any[]): boolean {
      if (chunk) {
        if (typeof chunk === 'object' && !(chunk instanceof Buffer)) {
          try {
            responseBody += JSON.stringify(chunk);
          } catch {
            responseBody += '[Unserializable Object]';
          }
        } else {
          responseBody += chunk.toString();
        }
      }
      return originalWrite.apply(this, [chunk, ...args]);
    };

    const originalSend = res.send;
    res.send = function (body?: any): Response {
      if (body instanceof Stream) {
        // If the body is a stream, we won't log its content
        responseBody = '[Stream]';
      } else if (typeof body === 'object') {
        try {
          responseBody = JSON.stringify(body);
        } catch {
          responseBody = '[Unserializable Object]';
        }
      } else {
        responseBody = String(body);
      }
      return originalSend.call(this, body);
    };

    const originalEnd = res.end;
    res.end = function (chunk?: any, ...args: any[]): Response {
      if (chunk) {
        if (typeof chunk === 'object' && !(chunk instanceof Buffer)) {
          try {
            responseBody += JSON.stringify(chunk);
          } catch {
            responseBody += '[Unserializable Object]';
          }
        } else {
          responseBody += chunk.toString();
        }
      }
      return originalEnd.apply(this, [chunk, ...args]);
    };

    res.addListener('finish', function () {
      logger.log(`${req.headers['x-request-id']} ${req.method} ${req.originalUrl}`);
      logger.log(`${req.headers['x-request-id']} ${res.statusCode} ${responseBody}`);
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
