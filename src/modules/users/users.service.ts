import { Injectable } from '@nestjs/common';

import { hashPassword } from 'better-auth/crypto';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { UserDecidesUserTypeParams } from '../../shared/types';
import { ensureExists, ensurePrecondition, ensureUnique, ResponseHelper } from '../../shared/utils';
import { UpdatePushTokenDto } from './dto/push-token.dto';

@Injectable()
export class UsersService {
  constructor(private readonly repo: CryptogadaiRepository) {}

  async setUserType(userId: string, userType: UserDecidesUserTypeParams['userType']) {
    const user = await this.repo.userViewsProfile({ userId });
    ensureExists(user, 'User not found');
    ensurePrecondition(user.emailVerified, 'Email must be verified before setting user type');

    // Check if user type has already been selected
    if (user.userType !== 'Undecided') {
      ensureUnique(false, 'User type already selected');
    }

    const payload: UserDecidesUserTypeParams = {
      userId,
      userType,
      decisionDate: new Date(),
    };

    try {
      await this.repo.userDecidesUserType(payload);
    } catch (error) {
      // Fallback: If the repository method fails for any reason
      // related to constraint violation, convert to conflict error
      const errorMessage = error?.message || '';
      if (
        errorMessage.includes('decision failed') ||
        errorMessage.includes('already made') ||
        errorMessage.includes('constraint')
      ) {
        ensureUnique(false, 'User type already selected');
      }
      throw error;
    }

    return {
      userType: payload.userType,
      message: `${payload.userType} successfully selected`,
    };
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
    const raw = await this.repo
      .sql`SELECT provider_id FROM auth_providers WHERE user_id = ${userId}`;

    if (raw.length === 0) {
      return [];
    }

    const accounts = raw as { provider_id: string }[];

    return accounts.map(account => account.provider_id);
  }

  async updatePushToken(userId: string, updateData: UpdatePushTokenDto) {
    // Format the token with ExponentPushToken prefix if provided
    let formattedToken: string | undefined;
    if (updateData.pushToken) {
      // Add prefix if not already present
      formattedToken = updateData.pushToken.startsWith('ExponentPushToken[')
        ? updateData.pushToken
        : `ExponentPushToken[${updateData.pushToken}]`;
    }

    const updatedProfile = await this.repo.userUpdatesProfile({
      id: userId,
      expoPushToken: formattedToken,
      updateDate: new Date(),
    });

    return {
      success: true,
      message: updateData.pushToken
        ? 'Push token updated successfully'
        : 'Push token cleared successfully',
      pushToken: updatedProfile.expoPushToken, // Keep as pushToken in API response for consistency
    };
  }
}
