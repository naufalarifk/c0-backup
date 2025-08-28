/** biome-ignore-all lint/suspicious/noExplicitAny: <explanation> */
import type { AdapterDebugLogs } from 'better-auth/adapters';

import { BetterAuthError } from 'better-auth';
import { createAdapter } from 'better-auth/adapters';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { unknownErrorToPlain } from '../../shared/utils/error';

interface AuthAdapterOptions {
  userRepo: CryptogadaiRepository;
  /**
   * Helps you debug issues with the adapter.
   */
  debugLogs?: AdapterDebugLogs;
}

export function authAdapter({ userRepo, debugLogs }: AuthAdapterOptions) {
  return createAdapter({
    config: {
      adapterId: 'repository',
      adapterName: 'Repository BetterAuth Adapter',
      debugLogs,
    },
    adapter: () => ({
      create({ model, data }) {
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
      update({ model, update, where }) {
        if (model === 'user') {
          // Field mapping handled in repository methods
          return userRepo.betterAuthUpdateUser(where, update);
        } else if (model === 'account') {
          return userRepo.betterAuthUpdateAccount(where, update);
        } else if (model === 'verification') {
          return userRepo.betterAuthUpdateVerification(where, update);
        } else {
          throw new BetterAuthError(`Unsupported updating data with model: ${model}`);
        }
      },
      updateMany({ model, update, where }) {
        if (model === 'user') {
          // Field mapping handled in repository methods
          return userRepo.betterAuthUpdateManyUsers(where, update);
        } else if (model === 'account') {
          return userRepo.betterAuthUpdateManyAccounts(where, update);
        } else if (model === 'verification') {
          // For verification, updateMany is not commonly used, delegate to single update
          return userRepo.betterAuthUpdateVerification(where, update);
        } else {
          throw new BetterAuthError(`Unsupported updateMany for model: ${model}`);
        }
      },
      async delete({ model, where }) {
        if (model === 'user') {
          // Field mapping handled in repository methods
          const deleted = await userRepo.betterAuthDeleteUser(where);
          return deleted; // Return deleted record or null if not found
        } else if (model === 'account') {
          return userRepo.betterAuthDeleteAccount(where);
        } else if (model === 'verification') {
          return userRepo.betterAuthDeleteVerification(where);
        } else {
          throw new BetterAuthError(`Unsupported deleting data with model: ${model}`);
        }
      },
      deleteMany({ model, where }) {
        if (model === 'user') {
          // Field mapping handled in repository methods
          return userRepo.betterAuthDeleteManyUsers(where);
        } else if (model === 'account') {
          return userRepo.betterAuthDeleteManyAccounts(where) as any;
        } else if (model === 'verification') {
          return userRepo.betterAuthDeleteManyVerifications(where) as any;
        } else {
          throw new BetterAuthError(`Unsupported deleteMany for model: ${model}`);
        }
      },
      async findOne({ model, where, select }) {
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
      findMany({ model, where, limit, offset, sortBy }) {
        if (model === 'user') {
          // Field mapping handled in repository methods
          return userRepo.betterAuthFindManyUsers(where, limit, offset, sortBy) as any;
        } else if (model === 'account') {
          return userRepo.betterAuthFindManyAccounts(where, limit, offset, sortBy) as any;
        } else if (model === 'verification') {
          return userRepo.betterAuthFindManyVerifications(where, limit, offset, sortBy) as any;
        } else {
          throw new BetterAuthError(`Unsupported findMany for model: ${model}`);
        }
      },
      async count({ model, where }) {
        if (model === 'user') {
          // Field mapping handled in repository methods
          const results = await userRepo.betterAuthFindManyUsers(where);
          return results.length;
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
