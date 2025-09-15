import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { Injectable } from '@nestjs/common';

import { MinioService } from './minio.service';

@Injectable()
export class MinioMockService extends MinioService {
  private readonly localDir = join(__dirname, 'minio-mock-storage');

  async onModuleInit() {
    /** mock */
  }

  async uploadFile(
    buffer: Buffer,
    fileName: string,
    options: {
      bucketName: string;
      objectName: string;
      metaData?: Record<string, string>;
    },
  ) {
    const objectFileAbsPath = join(this.localDir, options.bucketName, options.objectName);
    const objectDirAbsPath = dirname(objectFileAbsPath);
    const objectMetadataAbsPath = join(objectFileAbsPath, `${options.objectName}.metadata.json`);

    await mkdir(objectDirAbsPath, { recursive: true });
    await Promise.all([
      writeFile(objectFileAbsPath, buffer),
      writeFile(objectMetadataAbsPath, JSON.stringify({ ...options.metaData, fileName })),
    ]);

    return {
      bucket: options.bucketName,
      objectName: options.objectName,
      size: buffer.length,
      etag: 'mock-etag',
    };
  }

  async getFileUrl(bucketName: string, objectName: string, expiry?: number): Promise<string> {
    /** mock */
    expiry;
    return `http://cg-api.localhost/api/s3-mock/${bucketName}/${objectName}`;
  }

  async deleteFile(bucketName: string, objectName: string): Promise<void> {
    const objectFileAbsPath = join(this.localDir, bucketName, objectName);
    const objectMetadataAbsPath = join(objectFileAbsPath, `${objectName}.metadata.json`);
    await Promise.all([unlink(objectFileAbsPath), unlink(objectMetadataAbsPath)]);
  }
}
