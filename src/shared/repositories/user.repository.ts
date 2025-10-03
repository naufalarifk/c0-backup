import { UserTestRepository } from './user-test.repository';

/**
 * UserRepository <- BetterAuthRepository <- BaseRepository
 *
 * Repositories are responsible ONLY for data storage and retrieval.
 * Business logic such as encryption, hashing, TOTP verification, etc.
 * should be handled by services that use this repository.
 */
export abstract class UserRepository extends UserTestRepository {}
