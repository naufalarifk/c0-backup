import type { NestExpressApplication } from '@nestjs/platform-express';

import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';
import { apiReference } from '@scalar/nestjs-api-reference';

import { OpenAPI } from '../auth';

export async function docs(app: NestExpressApplication) {
  const [components, paths] = await Promise.all([OpenAPI.components, OpenAPI.getPaths()]);

  const config = new DocumentBuilder()
    .setTitle('Gadain Financial API')
    .setDescription('Comprehensive loan management platform')
    .setVersion('1.0')
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Merge components and paths with the document safely
  const mergedDocument = {
    ...document,
    components: {
      ...(components || {}), // Better Auth components first
      ...document.components, // NestJS components override
      // Ensure schemas are properly merged with NestJS schemas taking priority
      schemas: {
        ...(components?.schemas || {}), // Better Auth schemas first
        ...(document.components?.schemas || {}), // NestJS schemas override
      },
    },
    paths: {
      ...(paths || {}), // Better Auth paths first
      ...document.paths, // NestJS paths override
    },
  };

  SwaggerModule.setup('docs/swagger', app, mergedDocument as OpenAPIObject);

  app.use(
    '/docs/scalar',
    apiReference({
      content: mergedDocument,
      theme: 'bluePlanet',
    }),
  );
}
