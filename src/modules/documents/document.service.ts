import type { Queue } from 'bullmq';
import type {
  DocumentData,
  DocumentGenerationPayload,
  DocumentGenerationRequest,
  DocumentType,
  GeneratedDocument,
} from './document.types';

import { promises as fs } from 'fs';

import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';

import {
  assertArrayMapOf,
  assertDefined,
  assertPropNullableString,
  assertPropString,
} from 'typeshaper';
import { v4 as uuidv4 } from 'uuid';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { DocumentGenerationStatus, DocumentTypeEnum } from './document.types';
import { DocumentComposerFactory } from './document-composer.factory';
import { DocumentEventService } from './document-event.service';
import { DocumentStorageProviderFactory } from './document-storage-provider.factory';

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);

  constructor(
    private readonly documentComposerFactory: DocumentComposerFactory,
    private readonly storageProviderFactory: DocumentStorageProviderFactory,
    private readonly documentEventService: DocumentEventService,
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
    @InjectQueue('documentQueue')
    private readonly documentQueue: Queue<DocumentGenerationPayload>,
  ) {}

  async generateDocument(type: DocumentType, data: DocumentData): Promise<GeneratedDocument> {
    this.logger.log(`Generating document of type: ${type} for ID: ${data.id}`);

    const composer = this.documentComposerFactory.getComposer(type);
    if (!composer) {
      const error = `No composer found for document type: ${type}`;
      await this.documentEventService.emitDocumentFailed(data.id, error);
      throw new BadRequestException(error);
    }

    try {
      // Emit document generation started event
      await this.documentEventService.emitDocumentStarted(data.id);

      // Generate the document
      const document = await composer.generateDocument(data);

      // Store the document using the storage provider
      const storageProvider = this.storageProviderFactory.getDefaultProvider();
      const documentBuffer = await fs.readFile(document.filePath);

      const mimeType = 'application/octet-stream';
      const storageResult = await storageProvider.store(
        documentBuffer,
        document.fileName,
        mimeType,
        document.metadata,
      );

      // Clean up temporary file
      try {
        await fs.unlink(document.filePath);
      } catch (error) {
        this.logger.warn(`Failed to clean up temporary file: ${document.filePath}`, error);
      }

      // Update document with storage information
      const storedDocument: GeneratedDocument = {
        ...document,
        filePath: storageResult.filePath,
        size: storageResult.size,
      };

      // Emit document generation completed event
      await this.documentEventService.emitDocumentGenerated(
        data.id,
        type,
        storageResult.filePath,
        storedDocument.metadata,
      );

      this.logger.log(`Document generated and stored successfully: ${storedDocument.fileName}`);
      return storedDocument;
    } catch (error) {
      this.logger.error(`Failed to generate document: ${error.message}`, error.stack);
      await this.documentEventService.emitDocumentFailed(data.id, error.message);
      throw error;
    }
  }

  async getDocumentUrlOrStatus(
    entityId: string,
    documentType: DocumentTypeEnum,
  ): Promise<{ status: DocumentGenerationStatus; url?: string }> {
    this.logger.log(`Checking document status for entity ${entityId}, type ${documentType}`);

    try {
      const result = await this.repository.sql`
        SELECT status, document_url
        FROM loan_documents
        WHERE loan_id = ${entityId}
          AND document_type = ${documentType}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return { status: DocumentGenerationStatus.PENDING };
      }

      assertArrayMapOf(result, function (item) {
        assertDefined(item);
        assertPropString(item, 'status');
        assertPropNullableString(item, 'document_url');
        return item;
      });

      const doc = result[0];

      // Map database status to enum
      let status: DocumentGenerationStatus;
      const statusValue = typeof doc.status === 'string' ? doc.status.toLowerCase() : '';

      switch (statusValue) {
        case 'Completed':
          status = DocumentGenerationStatus.COMPLETED;
          break;
        case 'inprogress':
        case 'InProgress':
          status = DocumentGenerationStatus.IN_PROGRESS;
          break;
        case 'Failed':
          status = DocumentGenerationStatus.FAILED;
          break;
        case 'Queued':
        case 'pending':
        default:
          status = DocumentGenerationStatus.PENDING;
          break;
      }

      return {
        status,
        url: doc.document_url || undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get document status for ${entityId}: ${error.message}`,
        error.stack,
      );
      return { status: DocumentGenerationStatus.PENDING };
    }
  }

  /**
   * Create a document generation request and dispatch to BullMQ queue
   */
  async createDocumentRequest(
    type: DocumentTypeEnum,
    relatedEntityId: string,
    data: DocumentData,
    metadata?: Record<string, unknown>,
  ): Promise<DocumentGenerationRequest> {
    const requestId = uuidv4();

    const request: DocumentGenerationRequest = {
      id: requestId,
      type,
      status: DocumentGenerationStatus.PENDING,
      relatedEntityId,
      requestedAt: new Date(),
      metadata,
    };

    const payload: DocumentGenerationPayload = {
      type,
      data: {
        ...data,
        id: requestId,
        type,
      },
    };

    await this.documentQueue.add('generateDocument', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    this.logger.log(
      `Created and queued document generation request: ${requestId} for ${type} (${relatedEntityId})`,
    );

    return request;
  }
}
