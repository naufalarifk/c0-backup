export type PlatformCreateLoanOfferPrincipalInvoiceParams = {
  principalBlockchainKey: {
    key: 'btc' | 'eth' | 'sol';
    name: string;
    short_name: string;
    image: string;
  };
  principalAmount: number;
  // TODO
};

export type PlatformCreateLoanOfferPrincipalInvoiceResult = {
  principalBlockchainKey: string;
  principalAmount: number;
  // TODO
};

export abstract class IInvoiceService {
  abstract platformCreateLoanOfferPrincipalInvoice(
    params: PlatformCreateLoanOfferPrincipalInvoiceParams,
  ): Promise<PlatformCreateLoanOfferPrincipalInvoiceResult>;
}

export class InvoiceError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'InvoiceError';
  }
}
