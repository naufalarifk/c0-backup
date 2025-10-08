import { InjectQueue } from '@nestjs/bullmq';
import { BadRequestException, Inject, Injectable, Logger } from '@nestjs/common';

import { Queue } from 'bullmq';
import {
  assertArrayMapOf,
  assertDefined,
  assertProp,
  assertPropNullableString,
  assertPropString,
  check,
  isNumber,
  isString,
} from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import {
  type DocumentData,
  DocumentTypeEnum,
  type LoanAgreementData,
} from '../../documents/document.types';

export interface DocumentRequest {
  loanId: string;
  documentType: 'LoanAgreement' | 'LiquidationNotice' | 'RepaymentReceipt';
  requestedBy: string;
  priority: 'low' | 'normal' | 'high';
  metadata?: Record<string, unknown>;
}

export interface DocumentRequestResponse {
  requestId: string;
  status: 'Queued' | 'InProgress' | 'Completed' | 'Failed';
  estimatedCompletionTime?: string;
  documentUrl?: string;
  error?: string;
}

@Injectable()
export class LoanDocumentRequestService {
  private readonly logger = new TelemetryLogger(LoanDocumentRequestService.name);

  constructor(
    @Inject(CryptogadaiRepository)
    private readonly repository: CryptogadaiRepository,
    @InjectQueue('documentQueue')
    private readonly documentQueue: Queue,
  ) {}

  async requestDocumentGeneration(request: DocumentRequest): Promise<DocumentRequestResponse> {
    this.logger.log(
      `Requesting document generation for loan ${request.loanId}, type: ${request.documentType}`,
    );

    try {
      // 1. Validate loan exists and user has access
      const loanDetails = await this.validateLoanAccess(request.loanId, request.requestedBy);

      // 2. Check if document already exists or is being generated
      const existingRequest = await this.checkExistingDocumentRequest(
        request.loanId,
        request.documentType,
      );

      if (existingRequest) {
        return existingRequest;
      }

      // 3. Create document request record
      const requestId = await this.createDocumentRequest(request);

      // 4. Queue document generation directly
      await this.queueDocumentGeneration(requestId, request, loanDetails);

      // 5. Return response with request tracking info
      return {
        requestId,
        status: 'Queued',
        estimatedCompletionTime: this.getEstimatedCompletionTime(request.documentType),
      };
    } catch (error) {
      this.logger.error(
        `Failed to request document generation for loan ${request.loanId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getDocumentStatus(loanId: string, documentType: string): Promise<DocumentRequestResponse> {
    try {
      const result = await this.repository.sql`
        SELECT
          request_id,
          status,
          document_url,
          error_message,
          created_at
        FROM loan_documents
        WHERE loan_id = ${loanId}
          AND document_type = ${documentType}
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        throw new BadRequestException('Document request not found');
      }

      assertArrayMapOf(result, function (item) {
        assertDefined(item);
        assertProp(check(isString, isNumber), item, 'request_id');
        assertPropString(item, 'status');
        assertPropNullableString(item, 'document_url');
        assertPropNullableString(item, 'error_message');
        return item;
      });

      const doc = result[0];
      const normalizedStatus = this.normalizeStatusValue(doc.status) ?? 'Queued';
      return {
        requestId: String(doc.request_id),
        status: normalizedStatus,
        documentUrl: doc.document_url ?? undefined,
        error: doc.error_message ?? undefined,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get document status for loan ${loanId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async getDocumentUrl(loanId: string, documentType: string): Promise<string | null> {
    try {
      const status = await this.getDocumentStatus(loanId, documentType);
      return status.status === 'Completed' ? status.documentUrl || null : null;
    } catch (_error) {
      this.logger.warn(`Document not ready for loan ${loanId}, type: ${documentType}`);
      return null;
    }
  }

  private async validateLoanAccess(loanId: string, userId: string): Promise<unknown> {
    try {
      // Use repository method to validate loan access
      return await this.repository.userViewsLoanDetails({
        loanId,
        userId,
      });
    } catch (_error) {
      throw new BadRequestException('Loan not found or access denied');
    }
  }

  private async checkExistingDocumentRequest(
    loanId: string,
    documentType: string,
  ): Promise<DocumentRequestResponse | null> {
    try {
      const result = await this.repository.sql`
        SELECT
          request_id,
          status,
          document_url,
          error_message
        FROM loan_documents
        WHERE loan_id = ${loanId}
          AND document_type = ${documentType}
          AND status IN ('Queued', 'InProgress', 'Completed', 'Queued', 'InProgress', 'Completed')
        ORDER BY created_at DESC
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      assertArrayMapOf(result, function (item) {
        assertDefined(item);
        assertProp(check(isString, isNumber), item, 'request_id');
        assertPropString(item, 'status');
        assertPropNullableString(item, 'document_url');
        assertPropNullableString(item, 'error_message');
        return item;
      });

      const doc = result[0];
      const normalizedStatus = this.normalizeStatusValue(doc.status) ?? 'Queued';
      return {
        requestId: String(doc.request_id),
        status: normalizedStatus,
        documentUrl: doc.document_url ?? undefined,
        error: doc.error_message ?? undefined,
      };
    } catch (error) {
      this.logger.error(`Failed to check existing document request: ${error.message}`, error.stack);
      return null;
    }
  }

  private async createDocumentRequest(request: DocumentRequest): Promise<string> {
    const requestId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    try {
      await this.repository.sql`
        INSERT INTO loan_documents (
          request_id,
          loan_id,
          document_type,
          status,
          requested_by,
          priority,
          metadata,
          created_at,
          updated_at
        )
        VALUES (
          ${requestId},
          ${request.loanId},
          ${request.documentType},
          'Queued',
          ${request.requestedBy},
          ${request.priority},
          ${JSON.stringify(request.metadata || {})},
          NOW(),
          NOW()
        )
      `;

      return requestId;
    } catch (error) {
      this.logger.error(`Failed to create document request record: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async queueDocumentGeneration(
    requestId: string,
    request: DocumentRequest,
    loanDetails: unknown,
  ): Promise<void> {
    try {
      // Create document data based on type
      let documentData: unknown;

      switch (request.documentType) {
        case 'LoanAgreement':
          documentData = await this.createLoanAgreementData(requestId, request, loanDetails);
          break;
        case 'LiquidationNotice':
          documentData = this.createLiquidationNoticeData(requestId, request, loanDetails);
          break;
        case 'RepaymentReceipt':
          documentData = this.createRepaymentReceiptData(requestId, request, loanDetails);
          break;
        default:
          throw new BadRequestException(`Unsupported document type: ${request.documentType}`);
      }

      // Queue the document generation job
      await this.documentQueue.add(
        'generateDocument',
        {
          type: request.documentType,
          data: documentData,
        },
        {
          priority: this.getPriority(request.priority),
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      );

      this.logger.log(
        `Queued document generation for loan ${request.loanId}, type: ${request.documentType}`,
      );
    } catch (error) {
      this.logger.error(`Failed to queue document generation: ${error.message}`, error.stack);
      throw error;
    }
  }

  private async createLoanAgreementData(
    requestId: string,
    request: DocumentRequest,
    loanDetails: unknown,
  ): Promise<LoanAgreementData> {
    // Validate expected properties on loanDetails before accessing them
    assertDefined(loanDetails);
    assertPropString(loanDetails, 'borrowerUserId');
    assertPropString(loanDetails, 'lenderUserId');
    assertPropString(loanDetails, 'principalAmount');
    assertPropString(loanDetails, 'collateralAmount');
    // Interest might be numeric or string, ensure it's usable
    assertProp(check(isString, isNumber), loanDetails, 'interestAmount');
    assertProp(check(isString, isNumber), loanDetails, 'principalAmount');
    // Normalize loanDetails into a local typed shape for safer property access
    const ld = loanDetails as {
      borrowerUserId: string;
      lenderUserId: string;
      principalAmount: string;
      collateralAmount: string;
      interestAmount?: string | number;
      originationDate?: Date | string;
      maturityDate?: Date | string;
      principalCurrency?: { name?: string; symbol?: string };
      collateralCurrency?: { name?: string; symbol?: string };
    };

    // Fetch borrower and lender user information
    const borrowerInfo = await this.getUserInfo(ld.borrowerUserId);
    const lenderInfo = await this.getUserInfo(ld.lenderUserId);

    return {
      id: requestId,
      type: DocumentTypeEnum.LOAN_AGREEMENT,
      loanId: request.loanId,
      borrowerId: ld.borrowerUserId,
      lenderId: ld.lenderUserId,
      principalAmount: ld.principalAmount,
      collateralAmount: ld.collateralAmount,
      interestRate: this.calculateInterestRate(
        String(ld.interestAmount || '0'),
        ld.principalAmount,
      ),
      termMonths: this.calculateTermMonths(
        ld.originationDate instanceof Date
          ? ld.originationDate
          : new Date(ld.originationDate || Date.now()),
        ld.maturityDate instanceof Date ? ld.maturityDate : new Date(ld.maturityDate || Date.now()),
      ),
      originationDate:
        ld.originationDate instanceof Date
          ? ld.originationDate
          : new Date(ld.originationDate || Date.now()),
      maturityDate:
        ld.maturityDate instanceof Date ? ld.maturityDate : new Date(ld.maturityDate || Date.now()),
      principalCurrency: {
        name: ld.principalCurrency?.name || 'USDT',
        symbol: ld.principalCurrency?.symbol || 'USDT',
      },
      collateralCurrency: {
        name: ld.collateralCurrency?.name || 'Unknown',
        symbol: ld.collateralCurrency?.symbol || 'UNK',
      },
      borrower: {
        name: borrowerInfo.name || 'Unknown Borrower',
        email: borrowerInfo.email || 'unknown@example.com',
      },
      lender: {
        name: lenderInfo.name || 'Unknown Lender',
        email: lenderInfo.email || 'unknown@example.com',
        type: lenderInfo.userType === 'Institution' ? 'Company' : 'Individual',
      },
    };
  }

  private createLiquidationNoticeData(
    requestId: string,
    request: DocumentRequest,
    loanDetails: unknown,
  ): DocumentData {
    return {
      id: requestId,
      type: DocumentTypeEnum.LIQUIDATION_NOTICE,
      metadata: { loanId: request.loanId },
    } as DocumentData;
  }

  private createRepaymentReceiptData(
    requestId: string,
    request: DocumentRequest,
    loanDetails: unknown,
  ): DocumentData {
    return {
      id: requestId,
      type: DocumentTypeEnum.REPAYMENT_RECEIPT,
      metadata: { loanId: request.loanId },
    } as DocumentData;
  }

  private calculateInterestRate(interestAmount: string, principalAmount: string): number {
    const interest = parseFloat(interestAmount || '0');
    const principal = parseFloat(principalAmount || '1');
    return principal > 0 ? (interest / principal) * 100 : 0;
  }

  private calculateTermMonths(originationDate: Date, maturityDate: Date): number {
    if (!originationDate || !maturityDate) return 6;
    const diffTime = maturityDate.getTime() - originationDate.getTime();
    const diffMonths = diffTime / (1000 * 60 * 60 * 24 * 30.44);
    return Math.round(diffMonths);
  }

  private getPriority(priority: string): number {
    switch (priority) {
      case 'high':
        return 1;
      case 'normal':
        return 5;
      case 'low':
        return 10;
      default:
        return 5;
    }
  }

  private getEstimatedCompletionTime(documentType: string): string {
    switch (documentType) {
      case 'LoanAgreement':
        return '2-5 minutes';
      case 'LiquidationNotice':
        return '1-3 minutes';
      case 'RepaymentReceipt':
        return '1-2 minutes';
      default:
        return '2-5 minutes';
    }
  }

  private async getUserInfo(userId: string): Promise<{
    name: string;
    email: string;
    userType: string;
  }> {
    try {
      const result = await this.repository.sql`
        SELECT name, email, user_type
        FROM users
        WHERE id = ${userId}
        LIMIT 1
      `;

      if (result.length === 0) {
        return {
          name: 'Unknown User',
          email: 'unknown@example.com',
          userType: 'Individual',
        };
      }

      assertArrayMapOf(result, function (item) {
        assertDefined(item);
        assertPropString(item, 'name');
        assertPropString(item, 'email');
        assertPropString(item, 'user_type');
        return item;
      });

      const user = result[0];
      return {
        name: user.name,
        email: user.email,
        userType: user.user_type,
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch user info for ${userId}: ${error.message}`);
      return {
        name: 'Unknown User',
        email: 'unknown@example.com',
        userType: 'Individual',
      };
    }
  }

  private normalizeStatusValue(value: unknown): DocumentRequestResponse['status'] | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.toLowerCase();
    switch (normalized) {
      case 'Queued':
        return 'Queued';
      case 'InProgress':
      case 'inprogress':
        return 'InProgress';
      case 'Completed':
        return 'Completed';
      case 'Failed':
        return 'Failed';
      default:
        return undefined;
    }
  }
}
