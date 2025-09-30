import type { Job } from 'bullmq';
import type { DocumentGenerationPayload } from './document.types';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { DocumentService } from './document.service';
import { DocumentGenerationStatus, DocumentTypeEnum } from './document.types';

@Processor('documentQueue')
export class DocumentProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentProcessor.name);

  constructor(private readonly documentService: DocumentService) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { name, data } = job;

    // Only process generateDocument jobs, ignore other types
    if (name !== 'generateDocument') {
      return;
    }

    const { type, data: documentData } = data as DocumentGenerationPayload;
    const requestId = documentData.id; // Use document data ID as request ID

    this.logger.log(
      `Processing document generation job: ${job.id} for type: ${type}, request: ${requestId}`,
    );

    await this.documentService.generateDocument(type, documentData);
  }
}
