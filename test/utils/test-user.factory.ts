/**
 * Test data factory for creating consistent test users
 */

export interface TestUser {
  name: string;
  email: string;
  password: string;
  image?: string;
  callbackURL?: string;
  rememberMe?: boolean;
}

export class TestUserFactory {
  private static userCounter = 0;

  /**
   * Create a test user with unique email
   */
  static createUser(overrides?: Partial<TestUser>): TestUser {
    this.userCounter++;

    return {
      name: 'John Doe',
      email: `test.user.${Math.floor(Date.now() / 1000)}.${this.userCounter}@example.com`,
      password: 'SecurePassword123!',
      ...overrides,
    };
  }

  /**
   * Create a user with invalid email format
   */
  static createUserWithInvalidEmail(): TestUser {
    return this.createUser({ email: 'invalid-email-format' });
  }

  /**
   * Create a user with weak password
   */
  static createUserWithWeakPassword(): TestUser {
    return this.createUser({ password: '123' });
  }

  /**
   * Create a user with empty name
   */
  static createUserWithEmptyName(): TestUser {
    return this.createUser({ name: '' });
  }

  /**
   * Create multiple test users
   */
  static createUsers(count: number, overrides?: Partial<TestUser>): TestUser[] {
    return Array.from({ length: count }, () => this.createUser(overrides));
  }

  /**
   * Reset the counter (useful for tests)
   */
  static reset(): void {
    this.userCounter = 0;
  }
}
