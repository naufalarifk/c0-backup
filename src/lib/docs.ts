import type { NestExpressApplication } from '@nestjs/platform-express';

import { Logger } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

import { AuthService } from '../modules/auth/auth.service';

export async function docs(app: NestExpressApplication) {
  const authService = app.get<AuthService>(AuthService);
  const documentAuth = await (
    authService.api as unknown as { generateOpenAPISchema(): Promise<OpenAPIObject> }
  ).generateOpenAPISchema();

  const logger = new Logger(docs.name);

  const config = new DocumentBuilder()
    .setTitle('Gadain Financial API')
    .setDescription('Comprehensive loan management platform')
    .setVersion('1.0')
    .build();

  const document = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs/swagger', app, document);
  logger.log('Docs swagger: /docs/swagger');

  app.use(
    '/docs/auth',
    apiReference({
      content: documentAuth,
      theme: 'bluePlanet',
    }),
  );
  logger.log('Docs auth: /docs/auth');
}
