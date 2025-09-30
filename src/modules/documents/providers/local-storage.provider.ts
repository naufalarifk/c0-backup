import * as fs from 'fs/promises';
import * as path from 'path';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { v4 as uuidv4 } from 'uuid';

import { DocumentStorageProvider, type StorageResult } from '../document-storage-provider.abstract';
import {
  DocumentStorageProviderFlag,
  DocumentStorageProviderType,
} from '../document-storage-provider.factory';

@Injectable()
@DocumentStorageProviderFlag(DocumentStorageProviderType.LOCAL)
export class LocalStorageProvider extends DocumentStorageProvider {
  private readonly logger = new Logger(LocalStorageProvider.name);
  private readonly storagePath: string;
  private readonly baseUrl: string;

  constructor(private readonly configService: ConfigService) {
    super();

    this.storagePath = this.configService.get('DOCUMENTS_STORAGE_PATH', './storage/documents');
    this.baseUrl = this.configService.get('DOCUMENTS_BASE_URL', 'http://localhost:3000/documents');

    this.ensureStorageDirectoryExists();
  }

  private async ensureStorageDirectoryExists(): Promise<void> {
    try {
      await fs.access(this.storagePath);
    } catch {
      await fs.mkdir(this.storagePath, { recursive: true });
      this.logger.log(`Created storage directory: ${this.storagePath}`);
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
      const storageFileName = `${fileId}.${extension}`;
      const filePath = path.join(this.storagePath, storageFileName);

      await fs.writeFile(filePath, documentBuffer);

      // Store metadata in a separate file if provided
      if (metadata) {
        const metadataPath = path.join(this.storagePath, `${fileId}.meta.json`);
        const metadataWithFile = {
          originalFileName: fileName,
          mimeType,
          size: documentBuffer.length,
          createdAt: new Date().toISOString(),
          ...(metadata as Record<string, unknown>),
        };
        await fs.writeFile(metadataPath, JSON.stringify(metadataWithFile, null, 2));
      }

      this.logger.log(`Document stored successfully: ${storageFileName}`);

      return {
        filePath: storageFileName,
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
      const fullPath = path.join(this.storagePath, filePath);
      return await fs.readFile(fullPath);
    } catch (error) {
      this.logger.error(`Failed to retrieve document: ${filePath}`, error.stack);
      throw error;
    }
  }

  async delete(filePath: string): Promise<void> {
    try {
      const fullPath = path.join(this.storagePath, filePath);
      await fs.unlink(fullPath);

      // Also delete metadata file if it exists
      const fileId = path.parse(filePath).name;
      const metadataPath = path.join(this.storagePath, `${fileId}.meta.json`);
      try {
        await fs.unlink(metadataPath);
      } catch {
        // Ignore if metadata file doesn't exist
      }

      this.logger.log(`Document deleted successfully: ${filePath}`);
    } catch (error) {
      this.logger.error(`Failed to delete document: ${filePath}`, error.stack);
      throw error;
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = path.join(this.storagePath, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getSignedUrl(filePath: string, expirySeconds?: number): Promise<string> {
    // For local storage, we don't support expiry, just return the static URL
    return `${this.baseUrl}/${filePath}`;
  }
}
