import type { NestExpressApplication } from '@nestjs/platform-express';

import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { TagObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface.js';

import { apiReference } from '@scalar/nestjs-api-reference';

import { AuthService } from './modules/auth/auth.service';
import { TelemetryLogger } from './shared/telemetry.logger';

// Module configurations for documentation with corresponding tags
const MODULE_CONFIGS = [
  {
    name: 'users',
    title: 'Users API',
    description: 'User management and profile endpoints',
    path: 'docs/swagger/users',
    tags: ['Users', 'Profile', 'KYC'], // Users module includes Users, Profile and KYC controllers
  },
  {
    name: 'institutions',
    title: 'Institutions API',
    description: 'Institution management endpoints',
    path: 'docs/swagger/institutions',
    tags: ['Institutions'],
  },
  {
    name: 'accounts',
    title: 'Accounts API',
    description: 'Account management endpoints',
    path: 'docs/swagger/accounts',
    tags: ['Accounts'],
  },
  {
    name: 'beneficiaries',
    title: 'Beneficiaries API',
    description: 'Beneficiary management endpoints',
    path: 'docs/swagger/beneficiaries',
    tags: ['Beneficiaries'],
  },
  {
    name: 'withdrawals',
    title: 'Withdrawals API',
    description: 'Withdrawal management endpoints',
    path: 'docs/swagger/withdrawals',
    tags: ['Withdrawals'],
  },
  {
    name: 'sms',
    title: 'SMS API',
    description: 'SMS service endpoints',
    path: 'docs/swagger/sms',
    tags: ['SMS'],
  },
  {
    name: 'loans',
    title: 'Loans API',
    description: 'Loan management and operations endpoints',
    path: 'docs/swagger/loans',
    tags: ['Loans', 'Loan Offers', 'Loan Applications'],
  },
  {
    name: 'admin',
    title: 'Admin API',
    description: 'Administrative endpoints',
    path: 'docs/swagger/admin',
    tags: ['Admin'],
  },
  {
    name: 'finance-config',
    title: 'Finance Configuration API',
    description: 'Finance configuration and market data endpoints',
    path: 'docs/swagger/finance-config',
    tags: ['Blockchain Management', 'Currency Management', 'Exchange Rates'],
  },
];

export default async function docs(app: NestExpressApplication, url: string) {
  const authService = app.get<AuthService>(AuthService);
  const documentAuth = await authService.api.generateOpenAPISchema();

  const logger = new TelemetryLogger(docs.name);

  // Main API documentation (all modules)
  const mainConfig = new DocumentBuilder()
    .setTitle('Gadain Financial API')
    .setDescription('Comprehensive loan management platform')
    .setVersion(process.env.API_VERSION || '1.0')
    .addServer(url)
    .addCookieAuth('__Secure-cg.session_token')
    .build();

  const mainDocument = SwaggerModule.createDocument(app, mainConfig);

  SwaggerModule.setup('docs/swagger', app, () => mainDocument, {
    swaggerOptions: {
      displayRequestDuration: true,
      filter: true,
    },
    customSiteTitle: 'Crypto Gadai API Documentation',
  });
  logger.log('Docs swagger: /docs/swagger');

  // Module-specific documentation
  for (const moduleConfig of MODULE_CONFIGS) {
    try {
      // Create a filtered document containing only paths with the specified tags
      const moduleDocument = {
        ...mainDocument,
        paths: {},
        tags: [] as Array<TagObject>,
      };

      // Filter paths based on tags
      for (const [path, pathItem] of Object.entries(mainDocument.paths)) {
        for (const [method, operation] of Object.entries(pathItem)) {
          if (
            operation.tags &&
            operation.tags.some((tag: string) => moduleConfig.tags.includes(tag))
          ) {
            if (!moduleDocument.paths[path]) {
              moduleDocument.paths[path] = {};
            }
            moduleDocument.paths[path][method] = operation;
          }
        }
      }

      // Filter tags to only include relevant ones
      moduleDocument.tags = (mainDocument.tags || []).filter(tag => {
        return moduleConfig.tags.includes(tag.name);
      });

      // Update document info
      moduleDocument.info = {
        ...moduleDocument.info,
        title: moduleConfig.title,
        description: moduleConfig.description,
        version: process.env.API_VERSION || '1.0',
      };

      SwaggerModule.setup(moduleConfig.path, app, () => moduleDocument, {
        swaggerOptions: {
          displayRequestDuration: true,
          filter: true,
        },
        customSiteTitle: `${moduleConfig.title} Documentation`,
      });

      logger.log(`Docs ${moduleConfig.name}: /${moduleConfig.path}`);
    } catch (error) {
      logger.log(`Failed to create docs for ${moduleConfig.name}: ${error.message}`);
    }
  }

  // Auth documentation (Better Auth)
  app.use(
    '/docs/auth',
    apiReference({
      content: documentAuth,
      theme: 'bluePlanet',
    }),
  );
  logger.log('Docs auth: /docs/auth');
}
