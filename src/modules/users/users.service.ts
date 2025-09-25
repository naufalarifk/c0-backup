import { Injectable } from '@nestjs/common';

import { hashPassword } from 'better-auth/crypto';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { UserDecidesUserTypeParams } from '../../shared/types';
import { ensureExists, ensurePrecondition, ensureUnique, ResponseHelper } from '../../shared/utils';
import { UpdateProfileDto } from './dto/update-profile.dto';

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

  async getUserProfile(userId: string) {
    const user = await this.repo.userViewsProfile({ userId });
    ensureExists(user, 'User not found');

    // Transform user profile to match the expected API response format
    return {
      user: {
        id: Number(user.id),
        role: user.role,
        email: user.email,
        name: user.name,
        profilePictureUrl: user.profilePicture || null,
        googleId: user.googleId || null,
        createdDate: user.createdAt?.toISOString() || new Date().toISOString(),
        emailVerifiedDate: user.emailVerifiedDate?.toISOString() || null,
        lastLoginDate: user.lastLoginDate?.toISOString() || null,
        userType: user.userType === 'Undecided' ? null : user.userType,
        kycId: user.kycId,
        institutionId: user.institutionUserId,
        institutionRole: user.institutionRole,
        twoFaEnabled: user.twoFactorEnabled,
        isVerified: user.kycStatus === 'verified',
        verificationLevel: user.kycStatus === 'verified' ? 'verified' : 'unverified',
        kycStatus: user.kycStatus,
        phoneVerified: user.phone_number_verified || false,
        featureUnlockStatus: {
          tradingEnabled: user.kycStatus === 'verified',
          withdrawalEnabled: user.kycStatus === 'verified',
          loanBorrowingEnabled: user.kycStatus === 'verified',
          loanLendingEnabled: user.kycStatus === 'verified',
          institutionalFeaturesEnabled:
            user.userType === 'Institution' && user.kycStatus === 'verified',
        },
        requiredVerifications:
          user.kycStatus === 'verified'
            ? []
            : [
                {
                  type: 'kyc',
                  title: 'Complete KYC Verification',
                  description: 'Please complete your KYC verification to unlock all features',
                  actionText: 'Complete KYC',
                  priority: 'high' as const,
                },
              ],
      },
    };
  }

  async updateUserProfile(
    userId: string,
    updateData: UpdateProfileDto,
    profilePictureUrl?: string,
  ) {
    const profileData: { name?: string; profilePictureUrl?: string } = {};

    if (updateData.name !== undefined) {
      profileData.name = updateData.name;
    }

    if (profilePictureUrl !== undefined) {
      profileData.profilePictureUrl = profilePictureUrl;
    }

    const updatedProfile = await this.repo.userUpdatesProfile({
      id: userId,
      ...profileData,
      updateDate: new Date(),
    });

    return {
      user: {
        id: Number(updatedProfile.id),
        name: updatedProfile.name,
        profilePictureUrl: updatedProfile.profilePictureUrl,
      },
      message: 'Profile updated successfully',
    };
  }
}
