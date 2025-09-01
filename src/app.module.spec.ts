import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';

import { AppConfigService } from './shared/services/app-config.service';

describe('AppModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    const mockConfigService = {
      throttlerConfigs: {
        ttl: 60000,
        limit: 10,
      },
      authConfig: {
        url: 'http://localhost:3000',
        expirationTime: 3600,
        cookiePrefix: 'better-auth',
        maximumSessions: 5,
        sessionMaxAge: 604_800,
        sessionUpdateAge: 86_400,
        sessionCookieCacheAge: 300,
      },
      redisConfig: {
        host: 'localhost',
        port: 6379,
        password: '',
        db: 0,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      },
    };

    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ['.env.test'],
        }),
      ],
      providers: [
        {
          provide: AppConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();
  });

  afterEach(async () => {
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should have AppConfigService', () => {
    const configService = module.get<AppConfigService>(AppConfigService);
    expect(configService).toBeDefined();
  });
});
