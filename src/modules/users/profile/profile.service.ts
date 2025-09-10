import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { FileValidatorService } from '../../../shared/services/file-validator.service';
import { MinioService } from '../../../shared/services/minio.service';
import { TelemetryLogger } from '../../../telemetry.logger';
@Injectable()
export class ProfileService {
  private readonly logger = new TelemetryLogger(ProfileService.name);

  constructor(
    private readonly userRepo: CryptogadaiRepository,
    private readonly minioService: MinioService,
    private readonly fileValidatorService: FileValidatorService,
  ) {}

  async findOne(userId: string) {
    const profile = await this.userRepo.userViewsProfile({ userId });

    // Convert profilePicture based on its format
    if (profile.profilePicture) {
      // Check if it's already a URL (from Google OAuth, etc.)
      if (
        profile.profilePicture.startsWith('http://') ||
        profile.profilePicture.startsWith('https://')
      ) {
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
