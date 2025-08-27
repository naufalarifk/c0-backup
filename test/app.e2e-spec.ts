import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from './../src/app.module';

// import { TestSetup } from './setup/test-setup';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  // beforeAll(async () => {
  //   // Setup test containers for database and redis
  //   await TestSetup.setupTestContainers();

  //   // Set environment variables for the test containers
  //   process.env.DATABASE_URL = TestSetup.getPostgresConnectionString();
  //   process.env.REDIS_URL = TestSetup.getRedisConnectionString();
  // }, 30000); // 30 second timeout for container setup

  // afterAll(async () => {
  //   // Cleanup test containers
  //   await TestSetup.teardownTestContainers();
  // }, 30000);

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });

  // it('/api/auth/ok (GET)', () => {
  //   return request(app.getHttpServer()).get('/api/auth/ok').expect(200).expect({ ok: true });
  // });

  // describe('/api/auth/sign-up/email (POST)', () => {
  //   const validUserData = {
  //     name: 'John Doe',
  //     email: 'john.doe@example.com',
  //     password: 'SecurePassword123!',
  //   };

  //   it('should successfully register a new user', async () => {
  //     const response = await request(app.getHttpServer())
  //       .post('/api/auth/sign-up/email')
  //       .send(validUserData)
  //       .expect(200);

  //     expect(response.body).toHaveProperty('user');
  //     // expect(response.body.user).toHaveProperty('id');
  //     // expect(response.body.user).toHaveProperty('email', validUserData.email);
  //     // expect(response.body.user).toHaveProperty('name', validUserData.name);
  //     // expect(response.body.user).toHaveProperty('emailVerified', false);
  //     // expect(response.body.user).not.toHaveProperty('password');
  //   }, 10000); // 10 second timeout for this test

  //   // it('should return 400 when email is missing', async () => {
  //   //   const invalidData = { ...validUserData };
  //   //   delete invalidData.email;

  //   //   await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(invalidData)
  //   //     .expect(400);
  //   // });

  //   // it('should return 400 when password is missing', async () => {
  //   //   const invalidData = { ...validUserData };
  //   //   delete invalidData.password;

  //   //   await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(invalidData)
  //   //     .expect(400);
  //   // });

  //   // it('should return 400 when name is missing', async () => {
  //   //   const invalidData = { ...validUserData };
  //   //   delete invalidData.name;

  //   //   await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(invalidData)
  //   //     .expect(400);
  //   // });

  //   // it('should return 400 when email format is invalid', async () => {
  //   //   const invalidData = { ...validUserData, email: 'invalid-email' };

  //   //   await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(invalidData)
  //   //     .expect(400);
  //   // });

  //   // it('should return 400 when password is too weak', async () => {
  //   //   const invalidData = { ...validUserData, password: '123' };

  //   //   await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(invalidData)
  //   //     .expect(400);
  //   // });

  //   // it('should return 400 when trying to register with existing email', async () => {
  //   //   // First registration
  //   //   await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(validUserData)
  //   //     .expect(200);

  //   //   // Second registration with same email
  //   //   const duplicateData = {
  //   //     ...validUserData,
  //   //     name: 'Jane Doe',
  //   //   };

  //   //   await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(duplicateData)
  //   //     .expect(400);
  //   // });

  //   // it('should handle special characters in name', async () => {
  //   //   const specialCharData = {
  //   //     ...validUserData,
  //   //     email: 'special.user@example.com',
  //   //     name: 'José María González-Pérez',
  //   //   };

  //   //   const response = await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(specialCharData)
  //   //     .expect(200);

  //   //   expect(response.body.user.name).toBe(specialCharData.name);
  //   // });

  //   // it('should trim whitespace from email and name', async () => {
  //   //   const whitespaceData = {
  //   //     ...validUserData,
  //   //     email: '  trimmed.user@example.com  ',
  //   //     name: '  Trimmed User  ',
  //   //   };

  //   //   const response = await request(app.getHttpServer())
  //   //     .post('/api/auth/sign-up/email')
  //   //     .send(whitespaceData)
  //   //     .expect(200);

  //   //   expect(response.body.user.email).toBe('trimmed.user@example.com');
  //   //   expect(response.body.user.name).toBe('Trimmed User');
  //   // });
  // });
});
