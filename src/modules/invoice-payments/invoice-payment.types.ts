export interface InvoicePaymentJobData {
  invoiceId: string;
  blockchainKey: string;
  walletAddress: string;
  transactionHash: string;
  amount: string;
  detectedAt: string;
  sourceAddress?: string;
  tokenStandard?: 'native' | 'erc20' | 'spl-token' | 'bitcoin';
  tokenIdentifier?: string;
  blockNumber?: number;
  metadata?: Record<string, unknown>;
}
