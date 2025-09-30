export enum DocumentTypeEnum {
  LOAN_AGREEMENT = 'LoanAgreement',
  LOAN_INVOICE = 'LoanInvoice',
  LIQUIDATION_NOTICE = 'LiquidationNotice',
  REPAYMENT_RECEIPT = 'RepaymentReceipt',
}

export interface DocumentData {
  id: string;
  type: DocumentTypeEnum;
  metadata?: Record<string, unknown>;
}

export interface LoanAgreementData extends DocumentData {
  loanId: string;
  borrowerId: string;
  lenderId: string;
  principalAmount: string;
  collateralAmount: string;
  interestRate: number;
  termMonths: number;
  originationDate: Date;
  maturityDate: Date;
  principalCurrency: {
    name: string;
    symbol: string;
  };
  collateralCurrency: {
    name: string;
    symbol: string;
  };
  borrower: {
    name: string;
    email: string;
  };
  lender: {
    name: string;
    email: string;
    type: 'Individual' | 'Company';
  };
}

export interface DocumentGenerationPayload {
  type: DocumentTypeEnum;
  data: DocumentData;
  outputPath?: string;
}

export enum DocumentGenerationStatus {
  PENDING = 'Pending',
  IN_PROGRESS = 'InProgress',
  COMPLETED = 'Completed',
  FAILED = 'Failed',
}

export interface GeneratedDocument {
  id: string;
  type: DocumentTypeEnum;
  filePath: string;
  fileName: string;
  size: number;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export interface DocumentGenerationRequest {
  id: string;
  type: DocumentTypeEnum;
  status: DocumentGenerationStatus;
  relatedEntityId: string; // e.g., loanId
  requestedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  filePath?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
}

export type DocumentType =
  | 'LoanAgreement'
  | 'LoanInvoice'
  | 'LiquidationNotice'
  | 'RepaymentReceipt';
