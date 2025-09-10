import { Test, TestingModule } from '@nestjs/testing';

import { AuthService } from './auth.service';
import { AUTH_INSTANCE_KEY } from './auth.symbols';

describe('AuthService', () => {
  let service: AuthService;
  // biome-ignore lint/suspicious/noExplicitAny: mock
  let mockAuthInstance: any;

  beforeEach(async () => {
    mockAuthInstance = {
      api: {
        signUp: jest.fn(),
        signIn: jest.fn(),
        signOut: jest.fn(),
        getSession: jest.fn(),
      },
      handler: jest.fn(),
      middleware: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AUTH_INSTANCE_KEY,
          useValue: mockAuthInstance,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('api', () => {
    it('should return the auth API endpoints', () => {
      const api = service.api;

      expect(api).toBe(mockAuthInstance.api);
      /** @TODO investigate further */
      // expect(api.signUp).toBeDefined();
      // expect(api.signIn).toBeDefined();
      expect(api.signOut).toBeDefined();
      expect(api.getSession).toBeDefined();
    });
  });

  describe('instance', () => {
    it('should return the complete auth instance', () => {
      const instance = service.instance;

      expect(instance).toBe(mockAuthInstance);
      expect(instance.api).toBeDefined();
      expect(instance.handler).toBeDefined();
      /** @TODO investigate further */
      // expect(instance.middleware).toBeDefined();
    });
  });

  describe('generic type support', () => {
    it('should support extended auth instances with plugins', () => {
      // This test validates that the generic typing works
      const extendedMockAuth = {
        ...mockAuthInstance,
        api: {
          ...mockAuthInstance.api,
          customPlugin: jest.fn(),
        },
      };

      const extendedService = new AuthService(extendedMockAuth);

      expect(extendedService.api.customPlugin).toBeDefined();
      expect(extendedService.instance).toBe(extendedMockAuth);
    });
  });
});
