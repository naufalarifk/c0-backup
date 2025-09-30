export type InvoiceType = 'LoanCollateral' | 'LoanPrincipal' | 'LoanRepayment';

export type InvoiceCreateParams = {
  userId: string | number;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  accountBlockchainKey?: string;
  accountTokenId?: string;
  invoiceType: InvoiceType;
  invoicedAmount: string;
  prepaidAmount?: string;
  invoiceDate: Date;
  dueDate?: Date;
  expiredDate?: Date;
};

export type InvoicePreparationResult = InvoiceCreateParams & {
  invoiceId: number;
  prepaidAmount: string;
  walletAddress: string;
  walletDerivationPath: string;
  payableAmount: string;
};

export abstract class IInvoiceService {
  abstract prepareInvoice(params: InvoiceCreateParams): Promise<InvoicePreparationResult>;
}

export class InvoiceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvoiceError';
  }
}
