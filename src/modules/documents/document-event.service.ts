import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';
import { assertDefined } from 'typeshaper';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';

@Injectable()
export class DocumentEventService {
  private readonly logger = new Logger(DocumentEventService.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
    @InjectQueue('documentQueue')
    private readonly documentQueue: Queue,
  ) {}

  async emitDocumentGenerated(
    requestId: string,
    documentType: string,
    documentUrl: string,
    metadata?: unknown,
  ): Promise<void> {
    const normalizedMetadata = this.normalizeMetadata(metadata);
    this.logger.log(`Document generated: ${requestId} of type ${documentType} at ${documentUrl}`);

    try {
      // Update the document request status in database
      await this.repository.sql`
        UPDATE loan_documents
        SET
          status = 'Completed',
          document_url = ${documentUrl},
          updated_at = NOW()
        WHERE request_id = ${requestId}
      `;

      // Emit notification event back to loan module
      await this.documentQueue.add(
        'documentCompleted',
        {
          requestId,
          documentType,
          documentUrl,
          metadata: normalizedMetadata,
        },
        {
          priority: 1, // High priority for completion notifications
        },
      );

      this.logger.log(`Document completion event emitted for request: ${requestId}`);
    } catch (error) {
      this.logger.error(
        `Failed to emit document generated event for ${requestId}: ${error.message}`,
        error.stack,
      );
    }
  }

  async emitDocumentFailed(requestId: string, error: string): Promise<void> {
    this.logger.error(`Document generation failed: ${requestId}, error: ${error}`);

    try {
      // Update the document request status in database
      await this.repository.sql`
        UPDATE loan_documents
        SET
          status = 'Failed',
          error_message = ${error},
          updated_at = NOW()
        WHERE request_id = ${requestId}
      `;

      // Emit failure notification event
      await this.documentQueue.add(
        'documentFailed',
        {
          requestId,
          error,
        },
        {
          priority: 1, // High priority for error notifications
        },
      );

      this.logger.log(`Document failure event emitted for request: ${requestId}`);
    } catch (dbError) {
      this.logger.error(
        `Failed to emit document failed event for ${requestId}: ${dbError.message}`,
        dbError.stack,
      );
    }
  }

  async emitDocumentStarted(requestId: string): Promise<void> {
    this.logger.log(`Document generation started: ${requestId}`);

    try {
      // Update the document request status in database
      await this.repository.sql`
        UPDATE loan_documents
        SET
          status = 'InProgress',
          updated_at = NOW()
        WHERE request_id = ${requestId}
      `;

      this.logger.log(`Document status updated to in_progress for request: ${requestId}`);
    } catch (error) {
      this.logger.error(
        `Failed to update document status for ${requestId}: ${error.message}`,
        error.stack,
      );
    }
  }

  private normalizeMetadata(metadata: unknown): Record<string, unknown> | undefined {
    if (metadata === undefined) {
      return undefined;
    }

    assertDefined(metadata, 'Document metadata must be defined when provided');

    if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
      throw new TypeError('Document metadata must be a plain object');
    }

    return metadata as Record<string, unknown>;
  }
}
