import { Injectable, OnModuleInit } from '@nestjs/common';

import { extension as getExtension, lookup as getMimeType } from 'mime-types';
import * as Minio from 'minio';

import { TelemetryLogger } from '../telemetry.logger';
import { AppConfigService } from './app-config.service';

export interface UploadResult {
  bucket: string;
  objectName: string;
  size: number;
  etag: string;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new TelemetryLogger(MinioService.name);
  private client: Minio.Client;
  private isLocalMode = false;

  constructor(private readonly configService: AppConfigService) {}

  async onModuleInit() {
    const config = this.configService.minioConfig;

    // Check if running in local/test mode
    this.isLocalMode = config.endpoint === 'local';

    // Parse endpoint properly to handle URLs with protocol
    let endPoint: string;
    let port: number;

    if (this.isLocalMode) {
      // Use in-memory mock for local mode
      endPoint = 'localhost';
      port = 9000;
      this.logger.log('Minio running in LOCAL mode - using mock storage');
    } else if (config.endpoint.startsWith('http://') || config.endpoint.startsWith('https://')) {
      const url = new URL(config.endpoint);
      endPoint = url.hostname;
      port = url.port ? parseInt(url.port) : url.protocol === 'https:' ? 443 : 80;
    } else {
      // Legacy format: "hostname:port"
      const parts = config.endpoint.split(':');
      endPoint = parts[0];
      port = parts[1] ? parseInt(parts[1]) : config.useSSL ? 443 : 9000;
    }

    this.client = new Minio.Client({
      endPoint,
      port,
      useSSL: config.useSSL,
      accessKey: config.accessKey,
      secretKey: config.secretKey,
    });

    if (!this.isLocalMode) {
      // Test connection and create default buckets
      await this.client.listBuckets();
    }
    await this.ensureDefaultBuckets();

    this.logger.log('Minio connected successfully');
  }

  /**
   * Upload file to specific bucket and path
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    options: {
      bucketName: string;
      objectName: string;
      metaData?: Record<string, string>;
    },
  ): Promise<UploadResult> {
    const { bucketName, objectName, metaData = {} } = options;

    // Ensure bucket exists
    await this.ensureBucketExists(bucketName);

    // In local mode, just return mock upload result
    if (this.isLocalMode) {
      this.logger.log(`Mock file upload in local mode: ${bucketName}/${objectName}`);
      return {
        bucket: bucketName,
        objectName,
        size: buffer.length,
        etag: 'mock-etag',
      };
    }

    // Auto-detect content type
    const contentType = getMimeType(fileName) || 'application/octet-stream';

    const uploadMetadata = {
      'Content-Type': contentType,
      ...metaData,
    };

    const uploadInfo = await this.client.putObject(
      bucketName,
      objectName,
      buffer,
      buffer.length,
      uploadMetadata,
    );

    this.logger.log(`File uploaded: ${bucketName}/${objectName}`);

    return {
      bucket: bucketName,
      objectName,
      size: buffer.length,
      etag: uploadInfo.etag,
    };
  }

  /**
   * Upload image with auto-generated filename (PUBLIC bucket)
   * Images can be accessed directly via URL
   */
  async uploadImage(buffer: Buffer, originalName: string): Promise<string> {
    const ext = getExtension(getMimeType(originalName) || '') || 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const objectName = `images/${fileName}`;

    await this.uploadFile(buffer, originalName, {
      bucketName: 'images',
      objectName,
    });

    return `images:${objectName}`;
  }

  /**
   * Upload document with auto-generated filename (PRIVATE bucket)
   * SECURITY: Only accepts IMAGE files (JPG, PNG, WebP)
   * PDFs and other document formats blocked for security
   */
  async uploadDocument(buffer: Buffer, originalName: string, userId: string): Promise<string> {
    const mimeType = getMimeType(originalName);

    // SECURITY: Only allow image formats for documents
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!mimeType || !allowedImageTypes.includes(mimeType)) {
      throw new Error(
        'Only image files (JPG, PNG, WebP) are allowed for document uploads. PDFs blocked for security.',
      );
    }

    const ext = getExtension(mimeType) || 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const objectName = `documents/${userId}/${fileName}`;

    await this.uploadFile(buffer, originalName, {
      bucketName: 'documents',
      objectName,
    });

    return `documents:${objectName}`;
  }

  /**
   * Get presigned download URL
   */
  async getFileUrl(bucketName: string, objectName: string, expiry = 300): Promise<string> {
    // In local mode, return a mock data URL since we don't have real MinIO
    if (this.isLocalMode) {
      return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
    }
    return await this.client.presignedGetObject(bucketName, objectName, expiry);
  }

  /**
   * Delete file
   */
  async deleteFile(bucketName: string, objectName: string): Promise<void> {
    await this.client.removeObject(bucketName, objectName);
    this.logger.log(`Deleted: ${bucketName}/${objectName}`);
  }

  /**
   * Get file as stream
   */
  async getObject(bucketName: string, objectName: string) {
    return await this.client.getObject(bucketName, objectName);
  }

  /**
   * Check if object exists
   */
  async statObject(bucketName: string, objectName: string) {
    return await this.client.statObject(bucketName, objectName);
  }

  /**
   * Check if file type is allowed image
   */
  isAllowedImageType(fileName: string): boolean {
    const mimeType = getMimeType(fileName);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return allowedTypes.includes(mimeType || '');
  }

  /**
   * Get MIME type from filename
   */
  getMimeType(fileName: string): string {
    return getMimeType(fileName) || 'application/octet-stream';
  }

  /**
   * Create bucket if not exists
   */
  private async ensureBucketExists(bucketName: string): Promise<void> {
    // Skip bucket operations in local mode
    if (this.isLocalMode) {
      this.logger.log(`Skipping bucket creation in local mode: ${bucketName}`);
      return;
    }

    try {
      const exists = await this.client.bucketExists(bucketName);
      if (!exists) {
        await this.client.makeBucket(bucketName);
        this.logger.log(`Created bucket: ${bucketName}`);
      }
    } catch (error: unknown) {
      const errorCode = (error as { code?: string })?.code;
      if (errorCode !== 'BucketAlreadyOwnedByYou' && errorCode !== 'BucketAlreadyExists') {
        this.logger.error(`Failed to ensure bucket ${bucketName} exists:`, error);
        throw error;
      }
    }

    // Set bucket policy (applies to both new and existing buckets)
    await this.setBucketPolicy(bucketName);
  }

  /**
   * Set appropriate bucket policy
   */
  private async setBucketPolicy(bucketName: string): Promise<void> {
    try {
      let policyConfig: Record<string, unknown>;

      // Public buckets for images that can be accessed directly
      if (['images', 'uploads'].includes(bucketName)) {
        policyConfig = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${bucketName}/*`],
            },
          ],
        };
      } else {
        // Private buckets for sensitive documents (KYC, etc)
        policyConfig = {
          Version: '2012-10-17',
          Statement: [], // No public access
        };
      }

      await this.client.setBucketPolicy(bucketName, JSON.stringify(policyConfig));
    } catch (error) {
      this.logger.warn(`Failed to set bucket policy for ${bucketName}:`, error.message);
      // Don't throw - bucket policy is not critical for functionality
    }
  }

  /**
   * Create default buckets with appropriate access policies
   */
  private async ensureDefaultBuckets(): Promise<void> {
    const buckets = [
      'images', // PUBLIC - profile pictures, public assets (images only)
      'documents', // PRIVATE - KYC docs (images only, NO PDFs for security)
      'uploads', // PUBLIC - temporary uploads, general files
    ];

    for (const bucket of buckets) {
      await this.ensureBucketExists(bucket);
    }
  }
}
