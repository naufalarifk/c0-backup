import { sso } from '@better-auth/sso';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import {
  admin,
  phoneNumber,
  twoFactor,
  username,
} from 'better-auth/plugins';
import { Redis } from 'ioredis';

const redis = new Redis('redis://localhost:6379');

export const auth = betterAuth({
  database: drizzleAdapter(
    {},
    {
      provider: 'pg',
      usePlural: true,
    },
  ),
  secondaryStorage: {
    get: async (key) => {
			return await redis.get(key);
		},
		set: async (key, value, ttl) => {
			if (ttl) await redis.set(key, value, 'EX', ttl)
			else await redis.set(key, value);
		},
		delete: async (key) => {
			await redis.del(key);
		}
  },
  emailAndPassword: {
    enabled: true,
  },
  session: {
    storeSessionInDatabase: true,
    preserveSessionInDatabase: true,
  },
  socialProviders: {
    google: {
      clientId: '',
      clientSecret: '',
    },
  },
  plugins: [twoFactor(), username(), phoneNumber(), sso(), admin()],
});
