import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';

import { DocumentStorageProvider } from './document-storage-provider.abstract';

export enum DocumentStorageProviderType {
  MINIO = 'minio',
  S3 = 's3',
  LOCAL = 'local',
}

export const DocumentStorageProviderFlag =
  DiscoveryService.createDecorator<DocumentStorageProviderType>();

@Injectable()
export class DocumentStorageProviderFactory {
  constructor(private readonly discoveryService: DiscoveryService) {}

  getProvider(type: DocumentStorageProviderType): DocumentStorageProvider | undefined {
    const providers = this.discoveryService.getProviders();
    const provider = providers.find(provider => {
      return (
        this.discoveryService.getMetadataByDecorator(DocumentStorageProviderFlag, provider) === type
      );
    })?.instance;
    return provider instanceof DocumentStorageProvider ? provider : undefined;
  }

  getDefaultProvider(): DocumentStorageProvider {
    // Try to get MinIO first, fallback to local
    return (
      this.getProvider(DocumentStorageProviderType.MINIO) ||
      this.getProvider(DocumentStorageProviderType.LOCAL) ||
      (() => {
        throw new InternalServerErrorException('No document storage provider available');
      })()
    );
  }
}
