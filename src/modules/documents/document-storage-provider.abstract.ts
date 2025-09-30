export interface StorageResult {
  filePath: string;
  fileName: string;
  size: number;
}

export abstract class DocumentStorageProvider {
  abstract store(
    documentBuffer: Buffer,
    fileName: string,
    mimeType: string,
    metadata?: Record<string, unknown>,
  ): Promise<StorageResult>;

  abstract retrieve(filePath: string): Promise<Buffer>;

  abstract delete(filePath: string): Promise<void>;

  abstract exists(filePath: string): Promise<boolean>;

  abstract getSignedUrl(filePath: string, expirySeconds?: number): Promise<string>;
}
