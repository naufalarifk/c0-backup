import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { FileValidatorService } from '../../../shared/services/file-validator.service';
import { MinioService } from '../../../shared/services/minio.service';
import { File } from '../../../shared/types';
import { TelemetryLogger } from '../../../telemetry.logger';
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
    if (profile.profilePicture) {
      // Check if it's already a URL (from Google OAuth, etc.)
      if (profile.profilePicture.startsWith('https://')) {
        // Already a valid URL, return as-is
        return profile;
      }

      // Check if it's in bucket:objectPath format (uploaded file)
      if (profile.profilePicture.includes(':')) {
        const [bucket, objectPath] = profile.profilePicture.split(':');
        if (bucket && objectPath) {
          // Generate presigned URL valid for 1 hour
          const profilePictureUrl = await this.minioService.getFileUrl(bucket, objectPath, 3600);

          return {
            ...profile,
            profilePicture: profilePictureUrl, // Replace with actual URL
          };
        }
      }

      // If format is unknown, log warning and remove it
      this.logger.warn(`Unknown profilePicture format: ${profile.profilePicture}`, {
        userId,
        format: 'unknown',
      });
      const { profilePicture: _profilePicture, ...profileWithoutPicture } = profile;
      return profileWithoutPicture;
    }

    return profile;
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
  async uploadProfilePicture(
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
