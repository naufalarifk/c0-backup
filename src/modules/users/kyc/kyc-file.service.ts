import { Injectable, Logger } from '@nestjs/common';

import { MinioService } from '../../../shared/services/minio.service';

@Injectable()
export class KycFileService {
  private readonly logger = new Logger(KycFileService.name);

  // File size limits (in bytes)
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private readonly ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

  constructor(private readonly minioService: MinioService) {}

  /**
   * Validate file before upload
   */
  private validateFile(fileBuffer: Buffer, mimeType?: string, originalName?: string): void {
    // Check file size
    if (fileBuffer.length > this.MAX_FILE_SIZE) {
      throw new Error(
        `File size exceeds limit. Maximum allowed: ${this.MAX_FILE_SIZE / (1024 * 1024)}MB`,
      );
    }

    // Enhanced MIME type validation using mime-types package
    if (originalName && !this.minioService.isAllowedImageType(originalName)) {
      throw new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.');
    }

    // Fallback MIME type check if filename validation fails
    if (mimeType && !this.ALLOWED_MIME_TYPES.includes(mimeType)) {
      throw new Error(`Invalid file type. Allowed types: ${this.ALLOWED_MIME_TYPES.join(', ')}`);
    }

    // Check if file is actually an image (basic check)
    if (fileBuffer.length < 8) {
      throw new Error('File appears to be corrupted or invalid');
    }
  }

  /**
   * Upload a single file to Minio and return the URL
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    userId: string,
    documentType: string,
    mimeType?: string,
  ): Promise<{ url: string; size: number }> {
    // Validate file before upload
    this.validateFile(fileBuffer, mimeType, originalName);

    const folder = `kyc/${userId}`;
    const sanitizedFileName = this.sanitizeFileName(originalName);
    const fileName = `${documentType}-${Date.now()}-${sanitizedFileName}`;
    const filePath = `${folder}/${fileName}`;

    try {
      const uploadResult = await this.minioService.uploadFile(fileBuffer, originalName, {
        bucketName: 'documents',
        objectName: filePath,
        metaData: {
          userId,
          documentType,
          originalName: sanitizedFileName,
          uploadedAt: new Date().toISOString(),
          contentType: mimeType || 'application/octet-stream',
          fileSize: fileBuffer.length.toString(),
        },
      });

      this.logger.log(`Single file uploaded successfully: ${filePath}`, {
        userId,
        documentType,
        fileName,
        size: fileBuffer.length,
        url: uploadResult.url,
      });

      return {
        url: uploadResult.url,
        size: fileBuffer.length,
      };
    } catch (error) {
      // Enhanced logging with business context before re-throwing
      this.logger.error(`KYC file upload failed for user ${userId}:`, {
        error: error.message,
        userId,
        documentType,
        fileName: sanitizedFileName,
        fileSize: fileBuffer.length,
        originalError: error.name, // Preserve original error type
      });

      // Re-throw original error to preserve error type and stack trace
      throw error;
    }
  }

  /**
   * Delete KYC files for a user
   */
  async deleteKycFiles(userId: string): Promise<void> {
    try {
      const files = await this.minioService.listFiles('documents', `kyc/${userId}/`);

      if (files.length === 0) {
        this.logger.log(`No KYC files found for user: ${userId}`);
        return;
      }

      const deletePromises = files
        .filter(file => file.name)
        .map(file => this.minioService.deleteFile('documents', file.name!));

      await Promise.all(deletePromises);

      this.logger.log(`Successfully deleted ${files.length} KYC files for user: ${userId}`, {
        userId,
        deletedCount: files.length,
      });
    } catch (error) {
      this.logger.error(`Failed to delete KYC files for user ${userId}:`, {
        error: error.message,
        userId,
      });
      throw new Error(`Failed to delete KYC files: ${error.message}`);
    }
  }

  /**
   * Get KYC file URLs for a user
   */
  async getKycFileUrls(userId: string): Promise<string[]> {
    try {
      const files = await this.minioService.listFiles('documents', `kyc/${userId}/`);
      return files
        .filter(file => file.name)
        .map(
          file => `${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT}/documents/${file.name}`,
        );
    } catch (error) {
      this.logger.error(`Failed to get KYC file URLs for user ${userId}:`, error);
      throw new Error(`Failed to get file URLs: ${error.message}`);
    }
  }

  /**
   * Sanitize filename to prevent security issues
   */
  private sanitizeFileName(filename: string): string {
    // Remove path separators and dangerous characters
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_')
      .replace(/_{2,}/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
  }
}
