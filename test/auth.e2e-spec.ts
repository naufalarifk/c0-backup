import type { INestApplication } from '@nestjs/common';
import type { App } from 'supertest/types';

import { Test, TestingModule } from '@nestjs/testing';

import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/auth.service';
import { TestSetup } from './setup/test-setup';
import { extractTokenAndCallback, extractVerificationUrl } from './utils';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let authService: AuthService;

  beforeAll(async () => {
    await TestSetup.setupTestContainers();
    const connectionString = TestSetup.getPostgresConnectionString();
    process.env.BETTER_AUTH_URL = 'http://localhost:3000';
    process.env.DATABASE_URL = connectionString;
    process.env.REDIS_HOST = TestSetup.getRedisConfig().host;
    process.env.REDIS_PORT = String(TestSetup.getRedisConfig().port);
    process.env.REDIS_PASSWORD = TestSetup.getRedisConfig().password;
    process.env.DATABASE_LOGGER = 'false';
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

    it('should email verification token after registration', async () => {
      const messages = await fetch('http://localhost:8025/api/v1/messages').then(res => res.json());
      const emailMeta = messages?.messages?.[0];
      expect(emailMeta).toBeDefined();
      expect(emailMeta.Subject).toContain('Verify your email address');
      expect(emailMeta.To[0].Address).toBe(validUserData.email);

      const id = emailMeta?.ID;
      const message = await fetch(`http://localhost:8025/api/v1/message/${id}`).then(res =>
        res.json(),
      );

      const urlVerify = extractVerificationUrl(message.Text);
      expect(urlVerify).toBeDefined();
      const { token, callbackURL } = extractTokenAndCallback(urlVerify!);
      expect(token).toBeDefined();
      expect(callbackURL).toBeDefined();
      // const _verify = await authService.api.verifyEmail({
      //   query: { token: token!, callbackURL: callbackURL! },
      // });
      console.log('urlVerify :>> ', urlVerify);
      await fetch(urlVerify!).then(res => res.json());
    });
  });

  // describe('Login email password', () => {
  //   it('should login successfully with correct credentials', async () => {
  //     const payload = {
  //       email: 'adib17r@gmail.com',
  //       password: 'SecurePassword123!',
  //     };
  //     const res = await authService.api.signInEmail({ body: payload });

  //     expect(res).toHaveProperty('token');
  //     expect(res).toHaveProperty('user');
  //     expect(res.user).toHaveProperty('id');
  //     expect(res.user).toHaveProperty('email', payload.email);
  //     expect(res.user).toHaveProperty('emailVerified', true);
  //     expect(res.user).not.toHaveProperty('password');
  //   });
  // });
});
