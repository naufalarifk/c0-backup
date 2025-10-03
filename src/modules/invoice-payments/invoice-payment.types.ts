export interface InvoicePaymentJobData {
  invoiceId?: string;
  blockchainKey: string;
  tokenId: string;
  walletAddress: string;
  walletDerivationPath: string;
  transactionHash: string;
  amount: string;
  detectedAt: string;
  sourceAddress?: string;
  tokenStandard?: 'native' | 'erc20' | 'bitcoin' | string;
  tokenIdentifier?: string;
  blockNumber?: number;
  metadata?: Record<string, unknown>;
}
