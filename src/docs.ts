import type { NestExpressApplication } from '@nestjs/platform-express';

import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

import { apiReference } from '@scalar/nestjs-api-reference';

import { AuthService } from './modules/auth/auth.service';
import { TelemetryLogger } from './telemetry.logger';

export default async function docs(app: NestExpressApplication, url: string) {
  const authService = app.get<AuthService>(AuthService);
  const documentAuth = await authService.api.generateOpenAPISchema();

  const logger = new TelemetryLogger(docs.name);

  const config = new DocumentBuilder()
    .setTitle('Gadain Financial API')
    .setDescription('Comprehensive loan management platform')
    .setVersion(process.env.API_VERSION || '1.0')
    .addServer(url)
    .addCookieAuth('__Secure-cg.session_token')
    .build();

  const document = () => SwaggerModule.createDocument(app, config);

  SwaggerModule.setup('docs/swagger', app, document, {
    swaggerOptions: {
      displayRequestDuration: true,
      filter: true,
    },
    customSiteTitle: 'Crypto Gadai API Documentation',
  });
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
