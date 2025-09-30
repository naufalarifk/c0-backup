import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { v4 as uuidv4 } from 'uuid';

import { MinioService } from '../../../shared/services/minio.service';
import { DocumentStorageProvider, type StorageResult } from '../document-storage-provider.abstract';
import {
  DocumentStorageProviderFlag,
  DocumentStorageProviderType,
} from '../document-storage-provider.factory';

@Injectable()
@DocumentStorageProviderFlag(DocumentStorageProviderType.MINIO)
export class MinioStorageProvider extends DocumentStorageProvider {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly bucketName: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly minioService: MinioService,
  ) {
    super();

    this.bucketName = this.configService.get('MINIO_DOCUMENTS_BUCKET', 'documents');
  }

  // Note: Bucket creation is handled by MinioService on initialization

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

      await this.minioService.uploadFile(documentBuffer, fileName, {
        bucketName: this.bucketName,
        objectName,
        metaData: metaData as Record<string, string>,
      });

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
      const stream = await this.minioService.getObject(this.bucketName, filePath);
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
      await this.minioService.deleteFile(this.bucketName, filePath);
      this.logger.log(`Document deleted successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete document: ${filePath}`, error.stack);
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await this.minioService.statObject(this.bucketName, filePath);
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
      const url = await this.minioService.getFileUrl(this.bucketName, filePath, expiry);
      return url;
    } catch (error) {
      this.logger.error(`Failed to generate URL for document: ${filePath}`, error.stack);
      throw error;
    }
  }
}
