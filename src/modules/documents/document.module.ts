import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { SharedModule } from '../../shared/shared.module';
import { LoanAgreementComposer } from './composers/loan-agreement.composer';
import { DocumentProcessor } from './document.processor';
import { DocumentService } from './document.service';
import { DocumentCompletionProcessor } from './document-completion.processor';
import { DocumentComposerFactory } from './document-composer.factory';
import { DocumentEventService } from './document-event.service';
import { DocumentQueueService } from './document-queue.service';
import { DocumentStorageProviderFactory } from './document-storage-provider.factory';
import { LocalStorageProvider } from './providers/local-storage.provider';
import { MinioStorageProvider } from './providers/minio-storage.provider';

@Module({
  imports: [
    DiscoveryModule,
    SharedModule,
    BullModule.registerQueue({
      name: 'documentQueue',
    }),
  ],
  providers: [
    // Core services
    DocumentService,
    DocumentQueueService,
    DocumentProcessor,
    DocumentCompletionProcessor,
    DocumentEventService,

    // Factories
    DocumentComposerFactory,
    DocumentStorageProviderFactory,

    // Storage Providers
    LocalStorageProvider,
    MinioStorageProvider,

    // Document Composers
    LoanAgreementComposer,
  ],
  exports: [DocumentService, DocumentQueueService, DocumentEventService],
})
export class DocumentModule {}
