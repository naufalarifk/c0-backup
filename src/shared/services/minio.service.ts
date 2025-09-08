import { Readable } from 'node:stream';

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { extension as getExtension, lookup as getMimeType } from 'mime-types';
import * as Minio from 'minio';

import { AppConfigService } from './app-config.service';

export interface UploadOptions {
  bucketName?: string;
  objectName?: string;
  metaData?: Record<string, string>;
}

export interface FileInfo {
  url: string;
  bucket: string;
  objectName: string;
  etag: string;
  size: number;
}

@Injectable()
export class MinioService implements OnModuleInit {
  private readonly logger = new Logger(MinioService.name);
  private minioClient: Minio.Client;

  constructor(private readonly configService: AppConfigService) {}

  async onModuleInit() {
    try {
      const minioConfig = this.configService.minioConfig;

      this.minioClient = new Minio.Client({
        endPoint: minioConfig.endpoint.split(':')[0],
        port: parseInt(minioConfig.endpoint.split(':')[1]),
        useSSL: minioConfig.useSSL,
        accessKey: minioConfig.accessKey,
        secretKey: minioConfig.secretKey,
      });

      // Test connection
      await this.minioClient.listBuckets();
      this.logger.log('Connected to Minio successfully');

      // Ensure default buckets exist
      await this.ensureDefaultBuckets();
    } catch (error) {
      this.logger.error('Failed to connect to Minio:', error);
      throw error;
    }
  }

  /**
   * Upload file from buffer
   */
  async uploadFile(
    buffer: Buffer,
    fileName: string,
    options: UploadOptions = {},
  ): Promise<FileInfo> {
    const bucketName = options.bucketName || 'uploads';
    const objectName = options.objectName || `${Date.now()}-${fileName}`;

    // Enhanced metadata with automatic MIME type detection
    const detectedMimeType = getMimeType(fileName) || 'application/octet-stream';
    const metaData = {
      'Content-Type': detectedMimeType,
      'X-File-Size': buffer.length.toString(),
      'X-Upload-Date': new Date().toISOString(),
      ...options.metaData, // User metadata can override defaults
    };

    try {
      await this.ensureBucketExists(bucketName);

      const uploadInfo = await this.minioClient.putObject(
        bucketName,
        objectName,
        buffer,
        buffer.length,
        metaData,
      );

      const url = await this.getFileUrl(bucketName, objectName);

      this.logger.log(`File uploaded successfully:`, {
        bucket: bucketName,
        objectName,
        fileName,
        size: buffer.length,
        mimeType: detectedMimeType,
        etag: uploadInfo.etag,
      });

      return {
        url,
        bucket: bucketName,
        objectName,
        etag: uploadInfo.etag,
        size: buffer.length,
      };
    } catch (error) {
      // Log technical details at infrastructure level
      this.logger.error(`Minio upload failed:`, {
        error: error.message,
        bucket: bucketName,
        objectName,
        fileName,
        size: buffer.length,
        mimeType: detectedMimeType,
        errorType: error.name,
      });

      // Re-throw to preserve original error type
      throw error;
    }
  }

  /**
   * Upload file from stream
   */
  async uploadStream(
    stream: Readable,
    fileName: string,
    size: number,
    options: UploadOptions = {},
  ): Promise<FileInfo> {
    const bucketName = options.bucketName || 'uploads';
    const objectName = options.objectName || `${Date.now()}-${fileName}`;

    // Enhanced metadata with automatic MIME type detection
    const detectedMimeType = getMimeType(fileName) || 'application/octet-stream';
    const metaData = {
      'Content-Type': detectedMimeType,
      'X-File-Size': size.toString(),
      'X-Upload-Date': new Date().toISOString(),
      'X-Upload-Method': 'stream',
      ...options.metaData, // User metadata can override defaults
    };

    try {
      await this.ensureBucketExists(bucketName);

      const uploadInfo = await this.minioClient.putObject(
        bucketName,
        objectName,
        stream,
        size,
        metaData,
      );

      const url = await this.getFileUrl(bucketName, objectName);

      this.logger.log(`Stream uploaded successfully:`, {
        bucket: bucketName,
        objectName,
        fileName,
        size,
        mimeType: detectedMimeType,
        etag: uploadInfo.etag,
      });

      return {
        url,
        bucket: bucketName,
        objectName,
        etag: uploadInfo.etag,
        size,
      };
    } catch (error) {
      // Log technical details for stream upload
      this.logger.error(`Minio stream upload failed:`, {
        error: error.message,
        bucket: bucketName,
        objectName,
        fileName,
        size,
        mimeType: detectedMimeType,
        errorType: error.name,
      });

      throw error;
    }
  }

  /**
   * Get file download URL (presigned)
   */
  async getFileUrl(
    bucketName: string,
    objectName: string,
    expiry = 7 * 24 * 60 * 60,
  ): Promise<string> {
    try {
      return await this.minioClient.presignedGetObject(bucketName, objectName, expiry);
    } catch (error) {
      this.logger.error(`Failed to get URL for ${bucketName}/${objectName}:`, error);
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(bucketName: string, objectName: string): Promise<void> {
    try {
      await this.minioClient.removeObject(bucketName, objectName);
      this.logger.log(`Deleted file: ${bucketName}/${objectName}`);
    } catch (error) {
      this.logger.error(`Failed to delete file ${bucketName}/${objectName}:`, error);
      throw error;
    }
  }

  /**
   * List files in bucket
   */
  listFiles(bucketName: string, prefix?: string): Promise<Minio.BucketItem[]> {
    try {
      const objects: Minio.BucketItem[] = [];
      const stream = this.minioClient.listObjects(bucketName, prefix, true);

      return new Promise((resolve, reject) => {
        stream.on('data', (obj: Minio.BucketItem) => {
          if (obj.name) {
            objects.push(obj);
          }
        });
        stream.on('error', reject);
        stream.on('end', () => resolve(objects));
      });
    } catch (error) {
      this.logger.error(`Failed to list files in bucket ${bucketName}:`, error);
      throw error;
    }
  }

  /**
   * Get file info
   */
  async getFileInfo(bucketName: string, objectName: string): Promise<Minio.BucketItemStat> {
    try {
      return await this.minioClient.statObject(bucketName, objectName);
    } catch (error) {
      this.logger.error(`Failed to get file info for ${bucketName}/${objectName}:`, error);
      throw error;
    }
  }

  /**
   * Create bucket if it doesn't exist
   */
  async ensureBucketExists(bucketName: string): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(bucketName);
        this.logger.log(`Created bucket: ${bucketName}`);

        // Set public read policy for public buckets
        if (['uploads', 'images'].includes(bucketName)) {
          await this.setBucketPolicy(bucketName, 'public-read');
        }
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket ${bucketName} exists:`, error);
      throw error;
    }
  }

  /**
   * Set bucket policy
   */
  async setBucketPolicy(bucketName: string, policy: 'public-read' | 'private'): Promise<void> {
    try {
      let policyConfig: Record<string, unknown>;

      if (policy === 'public-read') {
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
        policyConfig = {
          Version: '2012-10-17',
          Statement: [],
        };
      }

      await this.minioClient.setBucketPolicy(bucketName, JSON.stringify(policyConfig));
      this.logger.log(`Set bucket policy for ${bucketName}: ${policy}`);
    } catch (error) {
      this.logger.error(`Failed to set bucket policy for ${bucketName}:`, error);
      throw error;
    }
  }

  /**
   * Ensure default buckets exist
   */
  private async ensureDefaultBuckets(): Promise<void> {
    const defaultBuckets = ['uploads', 'documents', 'images'];

    for (const bucket of defaultBuckets) {
      await this.ensureBucketExists(bucket);
    }
  }

  /**
   * Get Minio client for advanced operations
   */
  getClient(): Minio.Client {
    return this.minioClient;
  }

  /**
   * Get MIME type from filename
   */
  getMimeType(fileName: string): string {
    return getMimeType(fileName) || 'application/octet-stream';
  }

  /**
   * Get file extension from MIME type
   */
  getFileExtension(mimeType: string): string | false {
    return getExtension(mimeType);
  }

  /**
   * Validate if file type is allowed for specific use case
   */
  isAllowedImageType(fileName: string): boolean {
    const mimeType = this.getMimeType(fileName);
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    return allowedTypes.includes(mimeType);
  }

  /**
   * Validate if file type is allowed document
   */
  isAllowedDocumentType(fileName: string): boolean {
    const mimeType = this.getMimeType(fileName);
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];
    return allowedTypes.includes(mimeType);
  }
}
