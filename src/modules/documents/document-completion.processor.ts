import type { Job } from 'bullmq';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';

interface DocumentCompletionPayload {
  requestId: string;
  documentType: string;
  documentUrl: string;
  metadata?: Record<string, unknown>;
}

interface DocumentFailurePayload {
  requestId: string;
  error: string;
}

@Processor('documentQueue')
export class DocumentCompletionProcessor extends WorkerHost {
  private readonly logger = new Logger(DocumentCompletionProcessor.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { name, data } = job;

    switch (name) {
      case 'documentCompleted':
        await this.handleDocumentCompleted(data as DocumentCompletionPayload);
        break;
      case 'documentFailed':
        await this.handleDocumentFailed(data as DocumentFailurePayload);
        break;
      default:
        this.logger.warn(`Unknown job type: ${name}`);
    }
  }

  private async handleDocumentCompleted(payload: DocumentCompletionPayload): Promise<void> {
    this.logger.log(`Processing document completion: ${payload.requestId}`);

    try {
      // Get the loan ID from the document request
      const documentInfo = await this.repository.sql`
        SELECT loan_id, document_type
        FROM loan_documents
        WHERE request_id = ${payload.requestId}
        LIMIT 1
      `;

      if (documentInfo.length === 0) {
        this.logger.warn(`No document found for request: ${payload.requestId}`);
        return;
      }

      const doc = documentInfo[0] as {
        loan_id: string;
        document_type: string;
      };

      // For loan agreements, we might want to trigger additional actions
      if (doc.document_type === 'LoanAgreement') {
        this.logger.log(`Loan agreement document completed for loan: ${doc.loan_id}`);

        // Here we could:
        // 1. Send notification to borrower and lender
        // 2. Update loan status if needed
        // 3. Log the event for audit purposes

        // For now, just log the completion
        this.logger.log(`Document ${payload.documentType} completed for loan ${doc.loan_id}`);
      }

      this.logger.log(`Document completion processed successfully: ${payload.requestId}`);
    } catch (error) {
      this.logger.error(`Failed to process document completion: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async handleDocumentFailed(payload: DocumentFailurePayload): Promise<void> {
    this.logger.log(`Processing document failure: ${payload.requestId}`);

    try {
      // Get the loan ID from the document request
      const documentInfo = await this.repository.sql`
        SELECT loan_id, document_type
        FROM loan_documents
        WHERE request_id = ${payload.requestId}
        LIMIT 1
      `;

      if (documentInfo.length === 0) {
        this.logger.warn(`No document found for request: ${payload.requestId}`);
        return;
      }

      const doc = documentInfo[0] as {
        loan_id: string;
        document_type: string;
      };

      this.logger.error(
        `Document generation failed for loan ${doc.loan_id}, type: ${doc.document_type}, error: ${payload.error}`,
      );

      // Here we could:
      // 1. Send error notification to admin
      // 2. Schedule retry if appropriate
      // 3. Log the failure for audit purposes

      this.logger.log(`Document failure processed: ${payload.requestId}`);
    } catch (error) {
      this.logger.error(`Failed to process document failure: ${error.message}`, error.stack);
      throw error;
    }
  }
}
