import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { FileValidatorService } from '../../../shared/services/file-validator.service';
import { MinioService } from '../../../shared/services/minio.service';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { File } from '../../../shared/types';
import { assertDefined, assertPropNullableString } from '../../../shared/utils/assertions.js';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new TelemetryLogger(ProfileService.name);

  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly minioService: MinioService,
    private readonly fileValidatorService: FileValidatorService,
  ) {}

  async findOne(userId: string) {
    const profile = await this.repo.userViewsProfile({ userId });

    // Convert profilePicture based on its format
    let processedProfile = { ...profile };
    if (profile.profilePicture) {
      // Check if it's already a URL (from Google OAuth, etc.)
      if (profile.profilePicture.startsWith('https://')) {
        // Already a valid URL, use as-is
        processedProfile = profile;
      } else if (profile.profilePicture.includes(':')) {
        // Check if it's in bucket:objectPath format (uploaded file)
        const [bucket, objectPath] = profile.profilePicture.split(':');
        if (bucket && objectPath) {
          // Generate presigned URL valid for 1 hour
          const profilePictureUrl = await this.minioService.getFileUrl(bucket, objectPath, 3600);
          processedProfile = {
            ...profile,
            profilePicture: profilePictureUrl, // Replace with actual URL
          };
        }
      } else {
        // If format is unknown, log warning and remove it
        this.logger.warn(`Unknown profilePicture format: ${profile.profilePicture}`, {
          userId,
          format: 'unknown',
        });
        const { profilePicture: _profilePicture, ...profileWithoutPicture } = profile;
        processedProfile = profileWithoutPicture;
      }
    }

    // Add additional profile fields expected by tests
    const extendedProfile = {
      ...processedProfile,
      // Convert id to number as expected by tests
      id: Number(processedProfile.id),
      // Add field aliases expected by tests
      profilePictureUrl: processedProfile.profilePicture || null,
      googleId: processedProfile.googleId || null,
      createdDate: processedProfile.createdAt?.toISOString() || null,
      // Add missing OpenAPI schema fields
      emailVerifiedDate: processedProfile.emailVerifiedDate?.toISOString() || null,
      lastLoginDate: processedProfile.lastLoginDate?.toISOString() || null,
      userType: processedProfile.userType || null,
      kycId: processedProfile.kycId || null,
      institutionId: processedProfile.institutionUserId || null,
      institutionRole: processedProfile.institutionRole || null,
      // Boolean fields
      twoFaEnabled: processedProfile.twoFactorEnabled || false,
      isVerified: processedProfile.kycStatus === 'verified',
      // Verification level
      verificationLevel: this.getVerificationLevel(processedProfile),
      ...this.getExtendedProfileFields(processedProfile),
    };

    return extendedProfile;
  }

  private getExtendedProfileFields(profile: unknown) {
    assertDefined(profile);

    // Add phone verification status (from database field)
    const phoneVerified =
      'phone_number_verified' in profile ? !!profile.phone_number_verified : false;

    // Calculate feature unlock status based on verification levels
    const featureUnlockStatus = this.calculateFeatureUnlockStatus(profile);

    // Get required verifications based on current user state
    const requiredVerifications = this.getRequiredVerifications(profile);

    return {
      phoneVerified,
      featureUnlockStatus,
      requiredVerifications,
    };
  }

  private calculateFeatureUnlockStatus(profile: unknown) {
    assertDefined(profile);
    assertPropNullableString(profile, 'kycStatus');
    assertPropNullableString(profile, 'phone_number_verified');
    assertPropNullableString(profile, 'emailVerified');
    assertPropNullableString(profile, 'userType');

    const isKycVerified = profile.kycStatus === 'verified';
    const isPhoneVerified = profile.phone_number_verified || false;
    const isEmailVerified = profile.emailVerified || false;
    const hasUserType = profile.userType !== 'Undecided';
    const isInstitution = profile.userType === 'Institution';

    return {
      tradingEnabled: isEmailVerified && hasUserType && isKycVerified,
      withdrawalEnabled: isEmailVerified && hasUserType && isKycVerified,
      loanBorrowingEnabled: isEmailVerified && hasUserType && isKycVerified,
      loanLendingEnabled: isEmailVerified && hasUserType && isKycVerified,
      institutionalFeaturesEnabled: isInstitution && isKycVerified,
    };
  }

  private getVerificationLevel(
    profile: unknown,
  ): 'verified' | 'unverified' | 'pending' | 'rejected' {
    assertDefined(profile);
    assertPropNullableString(profile, 'kycStatus');

    if (profile.kycStatus === 'verified') {
      return 'verified';
    } else if (profile.kycStatus === 'pending') {
      return 'pending';
    } else if (profile.kycStatus === 'rejected') {
      return 'rejected';
    } else {
      return 'unverified';
    }
  }

  private getRequiredVerifications(profile) {
    assertDefined(profile);
    assertPropNullableString(profile, 'emailVerified');
    assertPropNullableString(profile, 'phone_number_verified');
    assertPropNullableString(profile, 'userType');
    assertPropNullableString(profile, 'kycStatus');

    const verifications: {
      type: 'email' | 'phone' | 'userType' | 'kyc';
      title: string;
      description: string;
      actionText: string;
      priority: 'low' | 'medium' | 'high' | 'critical';
    }[] = [];

    // Email verification
    if (!profile.emailVerified) {
      verifications.push({
        type: 'email',
        title: 'Email Verification',
        description: 'Please verify your email address to continue',
        actionText: 'Verify Email',
        priority: 'high',
      });
    }

    // User type selection
    if (profile.userType === 'Undecided') {
      verifications.push({
        type: 'userType',
        title: 'Account Type Selection',
        description: 'Please select your account type (Individual or Institution)',
        actionText: 'Select Account Type',
        priority: 'high',
      });
    }

    // Phone verification
    if (!profile.phone_number_verified) {
      verifications.push({
        type: 'phone',
        title: 'Phone Verification',
        description: 'Verify your phone number for enhanced security',
        actionText: 'Verify Phone',
        priority: 'medium',
      });
    }

    // KYC verification
    if (profile.kycStatus === 'none' && profile.userType !== 'Undecided') {
      verifications.push({
        type: 'kyc',
        title: 'Identity Verification',
        description: 'Complete KYC verification to unlock all features',
        actionText: 'Complete KYC',
        priority: 'high',
      });
    } else if (profile.kycStatus === 'rejected') {
      verifications.push({
        type: 'kyc',
        title: 'Identity Verification',
        description: 'Your KYC verification was rejected. Please resubmit',
        actionText: 'Resubmit KYC',
        priority: 'critical',
      });
    }

    return verifications;
  }

  /**
   * Process profile update with optional file upload
   */
  async processProfileUpdate(
    userId: string,
    updateProfileDto: UpdateProfileDto,
    profilePicture?: File,
  ): Promise<{ name?: string; image?: string }> {
    let profilePictureUrl: string | undefined;

    // If user uploaded a new profile picture, upload it first
    if (profilePicture) {
      const uploadResult = await this.uploadProfilePicture(
        profilePicture.buffer,
        profilePicture.originalname,
        userId,
        profilePicture.mimetype,
      );

      // Store bucket:objectPath format (consistent with KYC)
      profilePictureUrl = `${uploadResult.bucket}:${uploadResult.objectPath}`;
    }

    this.logger.log('Profile update processed', {
      userId,
      hasFile: !!profilePicture,
      hasNameUpdate: !!updateProfileDto.name,
    });

    return {
      name: updateProfileDto.name,
      image: profilePictureUrl,
    };
  }

  /**
   * Upload a profile picture to Minio and return the object info (NOT URL)
   * Moved from ProfileFileService for better cohesion
   */
  private async uploadProfilePicture(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    mimeType?: string,
  ): Promise<{ objectPath: string; bucket: string; size: number }> {
    // Validate file before upload using shared validator
    this.fileValidatorService.validateImageFile(fileBuffer, 2, mimeType, originalName);

    const folder = `profiles/${userId}`;
    const sanitizedFileName = this.fileValidatorService.sanitizeFileName(originalName);
    const fileName = `${Date.now()}-${sanitizedFileName}`;
    const filePath = `${folder}/${fileName}`;

    const uploadResult = await this.minioService.uploadFile(fileBuffer, originalName, {
      bucketName: 'images',
      objectName: filePath,
      metaData: {
        userId,
        documentType: 'profile-picture',
        originalName: sanitizedFileName,
        uploadedAt: new Date().toISOString(),
        contentType: mimeType || 'application/octet-stream',
        fileSize: fileBuffer.length.toString(),
      },
    });

    this.logger.log(`Profile picture uploaded successfully: ${filePath}`, {
      userId,
      fileName,
      size: fileBuffer.length,
      objectPath: filePath,
      bucket: 'images',
      uploadResult,
    });

    return {
      objectPath: uploadResult.objectName, // Use actual objectName from upload result
      bucket: uploadResult.bucket, // Use actual bucket from upload result
      size: uploadResult.size,
    };
  }
}
