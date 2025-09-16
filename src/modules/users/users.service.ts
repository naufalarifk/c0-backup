import { Injectable } from '@nestjs/common';

import { hashPassword } from 'better-auth/crypto';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { UserDecidesUserTypeParams } from '../../shared/types';
import { ensureExists, ensurePrecondition, ensureUnique, ResponseHelper } from '../../shared/utils';

@Injectable()
export class UsersService {
  constructor(private readonly repo: CryptogadaiRepository) {}

  async setUserType(userId: string, userType: UserDecidesUserTypeParams['userType']) {
    const user = await this.repo.betterAuthFindOneUser([{ field: 'id', value: userId }]);
    ensureExists(user, 'User not found');
    ensurePrecondition(user.emailVerified, 'Email must be verified before setting user type');

    const payload: UserDecidesUserTypeParams = {
      userId,
      userType,
      decisionDate: new Date(),
    };

    await this.repo.userDecidesUserType(payload);

    return ResponseHelper.action('User type set', {
      userType: payload.userType,
    });
  }

  async addCredentialProvider(userId: string, password: string) {
    const credentialAccount = await this.repo.betterAuthFindOneAccount([
      { field: 'userId', value: userId },
      { field: 'providerId', value: 'credential' },
    ]);
    ensureUnique(!credentialAccount, 'Credential provider already exists');

    const hashedPassword = await hashPassword(password);
    await this.repo.betterAuthCreateAccount({
      accountId: userId,
      userId,
      providerId: 'credential',
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return ResponseHelper.success('Credential provider added successfully', {
      providerId: 'credential',
    });
  }

  async getProviderAccounts(userId: string) {
    const accounts = await this.repo.betterAuthFindManyAccounts([
      { field: 'userId', value: userId },
    ]);

    return accounts.map(account => account.providerId);
  }
}
