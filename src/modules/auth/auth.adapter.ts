/** biome-ignore-all lint/suspicious/noExplicitAny: integration */
import type { AdapterDebugLogs } from 'better-auth/adapters';

import { BetterAuthError } from 'better-auth';
import { createAdapter } from 'better-auth/adapters';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { unknownErrorToPlain } from '../../shared/utils';
import { TelemetryLogger } from '../../telemetry.logger';

interface AuthAdapterOptions {
  userRepo: CryptogadaiRepository;
  /**
   * Helps you debug issues with the adapter.
   */
  debugLogs?: AdapterDebugLogs;
}

export function authAdapter({ userRepo, debugLogs }: AuthAdapterOptions) {
  const logger = new TelemetryLogger('AuthAdapter');
  return createAdapter({
    config: {
      adapterId: 'repository',
      adapterName: 'Repository BetterAuth Adapter',
      debugLogs,
      supportsJSON: true,
      supportsDates: true,
      supportsBooleans: true,
      supportsNumericIds: false,
    },
    adapter: () => ({
      create({ model, data, select, ...others }) {
        logger.debug('AuthAdapter:create', { model, data, select, ...others });
        if (model === 'user') {
          return userRepo.betterAuthCreateUser(data);
        } else if (model === 'session') {
          return userRepo.betterAuthCreateSession(data);
        } else if (model === 'account') {
          return userRepo.betterAuthCreateAccount(data);
        } else if (model === 'verification') {
          return userRepo.betterAuthCreateVerification(data);
        } else {
          throw new BetterAuthError(
            `Unsupported creating data with model: ${model} ${unknownErrorToPlain(data)}`,
          );
        }
      },
      update({ model, update, where, ...others }) {
        logger.debug('AuthAdapter:update', { model, update, where, ...others });
        if (model === 'user') {
          return userRepo.betterAuthUpdateUser(where, update);
        } else if (model === 'session') {
          return userRepo.betterAuthUpdateSession(where, update);
        } else if (model === 'account') {
          return userRepo.betterAuthUpdateAccount(where, update);
        } else if (model === 'verification') {
          return userRepo.betterAuthUpdateVerification(where, update);
        } else {
          throw new BetterAuthError(`Unsupported updating data with model: ${model}`);
        }
      },
      async updateMany({ model, update, where, ...others }) {
        logger.debug('AuthAdapter:updateMany', { model, update, where, ...others });
        if (model === 'user') {
          const results = await userRepo.betterAuthUpdateManyUsers(where, update);
          return Array.isArray(results) ? results.length : 0;
        } else if (model === 'account') {
          const results = await userRepo.betterAuthUpdateManyAccounts(where, update);
          return Array.isArray(results) ? results.length : 0;
        } else if (model === 'session') {
          // For session, updateMany is not commonly used, delegate to single update
          const result = await userRepo.betterAuthUpdateSession(where, update);
          return result ? 1 : 0;
        } else if (model === 'verification') {
          const result = await userRepo.betterAuthUpdateVerification(where, update);
          return result ? 1 : 0;
        } else {
          throw new BetterAuthError(`Unsupported updateMany for model: ${model}`);
        }
      },
      async delete({ model, where, ...others }) {
        logger.debug('AuthAdapter:delete', { model, where, ...others });
        try {
          if (model === 'user') {
            // Field mapping handled in repository methods
            const deleted = await userRepo.betterAuthDeleteUser(where);
            return deleted; // Return deleted record or null if not found
          } else if (model === 'account') {
            return userRepo.betterAuthDeleteAccount(where);
          } else if (model === 'session') {
            return userRepo.betterAuthDeleteSession(where);
          } else if (model === 'verification') {
            return userRepo.betterAuthDeleteVerification(where);
          } else {
            throw new BetterAuthError(`Unsupported deleting data with model: ${model}`);
          }
        } catch (error) {
          logger.error('AuthAdapter:delete error', { model, where, error });
          throw error;
        }
      },
      async deleteMany({ model, where, ...others }) {
        logger.debug('AuthAdapter:deleteMany', { model, where, ...others });
        try {
          if (model === 'user') {
            // Field mapping handled in repository methods
            return userRepo.betterAuthDeleteManyUsers(where);
          } else if (model === 'account') {
            return userRepo.betterAuthDeleteManyAccounts(where) as any;
          } else if (model === 'session') {
            return userRepo.betterAuthDeleteManySession(where) as any;
          } else if (model === 'verification') {
            return userRepo.betterAuthDeleteManyVerifications(where) as any;
          } else {
            throw new BetterAuthError(`Unsupported deleteMany for model: ${model}`);
          }
        } catch (error) {
          logger.error('AuthAdapter:deleteMany error', { model, where, error });
          throw error;
        }
      },
      async findOne({ model, where, select, ...others }) {
        logger.debug('AuthAdapter:findOne', { model, where, select, ...others });
        if (model === 'user') {
          // Field mapping handled in repository methods
          const user = await userRepo.betterAuthFindOneUser(where);
          if (!user) return null;

          // Handle field selection if specified
          if (select && select.length > 0) {
            const selectedUser: any = {};
            for (const field of select) {
              if (user[field] !== undefined) {
                selectedUser[field] = user[field];
              }
            }
            return selectedUser;
          }

          return user;
        } else if (model === 'session') {
          // Field mapping handled in repository methods
          return userRepo.betterAuthFindOneSession(where) as any;
        } else if (model === 'account') {
          return userRepo.betterAuthFindOneAccount(where) as any;
        } else if (model === 'verification') {
          return userRepo.betterAuthFindOneVerification(where) as any;
        } else {
          throw new BetterAuthError(`Unsupported findOne for model: ${model}`);
        }
      },
      findMany({ model, where, limit, offset, sortBy, ...others }) {
        logger.debug('AuthAdapter:findMany', { model, where, limit, offset, sortBy, ...others });
        if (model === 'user') {
          return userRepo.betterAuthFindManyUsers(where, limit, offset, sortBy);
        } else if (model === 'session') {
          // Sessions are stored in Redis, findMany not commonly used but implement for completeness
          return Promise.resolve([]);
        } else if (model === 'account') {
          return userRepo.betterAuthFindManyAccounts(where, limit, offset, sortBy);
        } else if (model === 'verification') {
          return userRepo.betterAuthFindManyVerifications(where, limit, offset, sortBy);
        } else {
          throw new BetterAuthError(`Unsupported findMany for model: ${model}`);
        }
      },
      async count({ model, where, ...others }) {
        logger.debug('AuthAdapter:count', { model, where, ...others });
        if (model === 'user') {
          const results = await userRepo.betterAuthFindManyUsers(where);
          return results.length;
        } else if (model === 'session') {
          // Sessions are in Redis, count would require scanning keys - return 0 for simplicity
          return 0;
        } else if (model === 'account') {
          const results = await userRepo.betterAuthFindManyAccounts(where);
          return results.length;
        } else if (model === 'verification') {
          const results = await userRepo.betterAuthFindManyVerifications(where);
          return results.length;
        } else {
          throw new BetterAuthError(`Unsupported count for model: ${model}`);
        }
      },
    }),
  });
}
