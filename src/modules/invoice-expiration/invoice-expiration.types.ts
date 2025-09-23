export interface InvoiceExpirationWorkerData {
  type: 'invoice-expiration-check';
  asOfDate?: string; // ISO date string
  batchSize?: number;
}

export interface ExpiredInvoiceData {
  id: string;
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  invoicedAmount: string;
  paidAmount: string;
  walletAddress: string;
  invoiceType: string;
  status: string;
  invoiceDate: Date;
  dueDate: Date | null;
  expiredDate: Date | null;
}

export interface InvoiceExpirationResult {
  processedCount: number;
  expiredCount: number;
  errors: string[];
}
