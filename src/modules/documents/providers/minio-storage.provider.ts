import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as Minio from 'minio';
import { v4 as uuidv4 } from 'uuid';

import { DocumentStorageProvider, type StorageResult } from '../document-storage-provider.abstract';
import {
  DocumentStorageProviderFlag,
  DocumentStorageProviderType,
} from '../document-storage-provider.factory';

@Injectable()
@DocumentStorageProviderFlag(DocumentStorageProviderType.MINIO)
export class MinioStorageProvider extends DocumentStorageProvider {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly minioClient: Minio.Client;
  private readonly bucketName: string;

  constructor(private readonly configService: ConfigService) {
    super();

    this.bucketName = this.configService.get('MINIO_DOCUMENTS_BUCKET', 'documents');

    // Parse endpoint to separate hostname and port
    const endpointConfig = this.configService.get('MINIO_ENDPOINT', 'localhost:9000');
    const [endPoint, endpointPort] = endpointConfig.split(':');
    const port = endpointPort
      ? parseInt(endpointPort, 10)
      : this.configService.get('MINIO_PORT', 9000);

    this.minioClient = new Minio.Client({
      endPoint,
      port,
      useSSL: this.configService.get('MINIO_USE_SSL', 'false') === 'true',
      accessKey: this.configService.get('MINIO_ACCESS_KEY', 'minioadmin'),
      secretKey: this.configService.get('MINIO_SECRET_KEY', 'minioadmin'),
    });

    this.ensureBucketExists();
  }

  private async ensureBucketExists(): Promise<void> {
    try {
      const exists = await this.minioClient.bucketExists(this.bucketName);
      if (!exists) {
        await this.minioClient.makeBucket(this.bucketName, 'us-east-1');
        this.logger.log(`Created bucket: ${this.bucketName}`);
      }
    } catch (error) {
      this.logger.error(`Failed to ensure bucket exists: ${error.message}`, error.stack);
    }
  }

  async store(
    documentBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata?: Record<string, unknown>,
  ): Promise<StorageResult> {
    try {
      const fileId = uuidv4();
      const extension = fileName.split('.').pop() || 'bin';
      const objectName = `${fileId}.${extension}`;

      const metaData = {
        'Content-Type': mimeType,
        'X-Original-Filename': fileName,
        ...(metadata as Record<string, unknown>),
      };

      await this.minioClient.putObject(
        this.bucketName,
        objectName,
        documentBuffer,
        documentBuffer.length,
        metaData,
      );

      this.logger.log(`Document stored successfully: ${objectName}`);

      return {
        filePath: objectName,
        fileName,
        size: documentBuffer.length,
      };
    } catch (error) {
      this.logger.error(`Failed to store document: ${error.message}`, error.stack);
      throw error;
    }
  }

  async retrieve(filePath: string): Promise<Buffer> {
    try {
      const stream = await this.minioClient.getObject(this.bucketName, filePath);
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('error', reject);
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error) {
      this.logger.error(`Failed to retrieve document: ${filePath}`, error.stack);
      throw error;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      await this.minioClient.removeObject(this.bucketName, filePath);
      this.logger.log(`Document deleted successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete document: ${filePath}`, error.stack);
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.minioClient.statObject(this.bucketName, filePath);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  async getSignedUrl(filePath: string, expirySeconds?: number): Promise<string> {
    try {
      // Default to 1 hour if not specified
      const expiry = expirySeconds || 3600;
      const url = await this.minioClient.presignedGetObject(this.bucketName, filePath, expiry);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate URL for document: ${filePath}`, error.stack);
      throw error;
    }
  }
}
