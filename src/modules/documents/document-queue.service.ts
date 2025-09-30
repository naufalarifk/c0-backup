import type { Queue } from 'bullmq';
import type { DocumentData, DocumentGenerationPayload } from './document.types';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';

import { DocumentService } from './document.service';
import { DocumentTypeEnum } from './document.types';

@Injectable()
export class DocumentQueueService {
  private readonly logger = new Logger(DocumentQueueService.name);

  constructor(
    @InjectQueue('documentQueue')
    private readonly documentQueue: Queue<DocumentGenerationPayload>,
    private readonly documentService: DocumentService,
  ) {}

  async queueDocumentGeneration(payload: DocumentGenerationPayload): Promise<string> {
    try {
      await this.documentQueue.add('generateDocument', payload, {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
      });

      this.logger.log(`Document generation queued: ${payload.type} for ID: ${payload.data.id}`);

      return payload.data.id; // Return the request ID
    } catch (error) {
      this.logger.error(`Failed to queue document generation: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Queue document generation with automatic request creation
   */
  async queueDocumentGenerationWithRequest(
    type: DocumentTypeEnum,
    relatedEntityId: string,
    data: unknown,
    metadata?: Record<string, unknown>,
  ): Promise<string> {
    const request = await this.documentService.createDocumentRequest(
      type,
      relatedEntityId,
      data as DocumentData,
      metadata,
    );

    return request.id;
  }
}
