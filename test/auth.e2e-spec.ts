import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';

import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/auth.service';
import { TestSetup } from './setup/test-setup';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let authService: AuthService;

  beforeAll(async () => {
    await TestSetup.setupTestContainers();
    const connectionString = TestSetup.getPostgresConnectionString();
    process.env.DATABASE_URL = connectionString;
    process.env.REDIS_HOST = TestSetup.getRedisConfig().host;
    process.env.REDIS_PORT = String(TestSetup.getRedisConfig().port);
    process.env.REDIS_PASSWORD = TestSetup.getRedisConfig().password;
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    authService = moduleFixture.get<AuthService>(AuthService);
    await app.init();
  });

  describe('Register email password', () => {
    const validUserData = {
      name: 'John Doe',
      email: 'adib17r@gmail.com',
      password: 'SecurePassword123!',
    };

    it('should successfully register a new user', async () => {
      const res = await authService.api.signUpEmail({ body: validUserData });

      expect(res).toHaveProperty('token');
      expect(res).toHaveProperty('user');
      expect(res.user).toHaveProperty('id');
      expect(res.user).toHaveProperty('name', validUserData.name);
      expect(res.user).toHaveProperty('email', validUserData.email);
      expect(res.user).toHaveProperty('emailVerified', false);
      expect(res.user).not.toHaveProperty('password');
    });
  });
});
