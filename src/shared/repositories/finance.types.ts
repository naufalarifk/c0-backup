// Finance types following use-case based naming convention from finance flows

// Account & Balance Management Types
export interface UserRetrievesAccountBalancesParams {
  userId: string;
}

export interface AccountBalance {
  id: string;
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  balance: string;
  accountType: string;
  pendingOperations?: {
    activeLoans: string;
    pendingWithdrawals: string;
    reservedCollateral: string;
  };
}

export interface UserRetrievesAccountBalancesResult {
  accounts: AccountBalance[];
  totalPortfolioValueUsd?: string;
}

export interface UserViewsAccountTransactionHistoryParams {
  accountId: string;
  mutationType?: string;
  fromDate?: Date | null;
  toDate?: Date | null;
  limit?: number;
  offset?: number;
}

export interface AccountMutation {
  id: string;
  accountId: string;
  mutationType: string;
  mutationDate: Date;
  amount: string;
  invoiceId?: string;
  withdrawalId?: string;
  invoicePaymentId?: string;
}

export interface UserViewsAccountTransactionHistoryResult {
  mutations: AccountMutation[];
  totalCount: number;
  hasMore: boolean;
}

// Invoice Management Types
export interface PlatformCreatesInvoiceParams {
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  invoicedAmount: string;
  walletDerivationPath: string;
  walletAddress: string;
  invoiceType: 'LoanCollateral' | 'LoanPrincipal' | 'LoanRepayment';
  invoiceDate: Date;
  dueDate?: Date | null;
}

export interface PlatformCreatesInvoiceResult {
  id: string;
  userId: string;
  walletAddress: string;
  invoiceType: string;
  status: string;
  invoicedAmount: string;
  paidAmount: string;
  invoiceDate: Date;
  dueDate?: Date | null;
}

export interface BlockchainDetectsInvoicePaymentParams {
  invoiceId: string;
  paymentHash: string;
  amount: string;
  paymentDate: Date;
}

export interface BlockchainDetectsInvoicePaymentResult {
  id: string;
  invoiceId: string;
  paymentHash: string;
  amount: string;
  paymentDate: Date;
}

export interface PlatformUpdatesInvoiceStatusParams {
  invoiceId: string;
  status: 'Pending' | 'PartiallyPaid' | 'Paid' | 'Overdue' | 'Expired' | 'Cancelled';
  expiredDate?: Date | null;
  notifiedDate?: Date | null;
}

export interface PlatformUpdatesInvoiceStatusResult {
  id: string;
  status: string;
  expiredDate?: Date | null;
  notifiedDate?: Date | null;
}

export interface UserViewsInvoiceDetailsParams {
  invoiceId: string;
}

export interface UserViewsInvoiceDetailsResult {
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
  dueDate?: Date | null;
  expiredDate?: Date | null;
  paidDate?: Date | null;
}

// Withdrawal Management Types
export interface UserRegistersWithdrawalBeneficiaryParams {
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  address: string;
}

export interface UserRegistersWithdrawalBeneficiaryResult {
  id: string;
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  address: string;
}

export interface UserRequestsWithdrawalParams {
  beneficiaryId: string;
  amount: string;
  requestDate: Date;
}

export interface UserRequestsWithdrawalResult {
  id: string;
  beneficiaryId: string;
  amount: string;
  requestAmount: string;
  status: string;
  requestDate: Date;
}

// Split withdrawal processing methods based on specific actions
export interface PlatformSendsWithdrawalParams {
  withdrawalId: string;
  sentAmount: string;
  sentHash: string;
  sentDate: Date;
}

export interface PlatformSendsWithdrawalResult {
  id: string;
  status: string;
  sentAmount: string;
  sentHash: string;
  sentDate: Date;
}

export interface PlatformConfirmsWithdrawalParams {
  withdrawalId: string;
  confirmedDate: Date;
}

export interface PlatformConfirmsWithdrawalResult {
  id: string;
  status: string;
  confirmedDate: Date;
}

export interface PlatformFailsWithdrawalParams {
  withdrawalId: string;
  failedDate: Date;
  failureReason: string;
}

export interface PlatformFailsWithdrawalResult {
  id: string;
  status: string;
  failedDate: Date;
  failureReason: string;
}

export interface AdminApprovesWithdrawalRefundParams {
  withdrawalId: string;
  reviewerUserId: string;
  approvalDate: Date;
}

export interface AdminApprovesWithdrawalRefundResult {
  id: string;
  status: string;
  failureRefundApprovedDate: Date;
}

export interface AdminRejectsWithdrawalRefundParams {
  withdrawalId: string;
  reviewerUserId: string;
  rejectionReason: string;
  rejectionDate: Date;
}

export interface AdminRejectsWithdrawalRefundResult {
  id: string;
  status: string;
  failureRefundRejectedDate: Date;
}

export interface UserViewsWithdrawalBeneficiariesParams {
  userId: string;
}

export interface WithdrawalBeneficiary {
  id: string;
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  address: string;
}

export interface UserViewsWithdrawalBeneficiariesResult {
  beneficiaries: WithdrawalBeneficiary[];
}

// Exchange Rate Management Types
export interface PlatformRetrievesExchangeRatesParams {
  blockchainKey?: string;
  baseCurrencyTokenId?: string;
  quoteCurrencyTokenId?: string;
}

export interface ExchangeRate {
  id: string;
  priceFeedId: string;
  bidPrice: string;
  askPrice: string;
  retrievalDate: Date;
  sourceDate: Date;
  blockchain: string;
  baseCurrency: string;
  quoteCurrency: string;
  source: string;
}

export interface PlatformRetrievesExchangeRatesResult {
  exchangeRates: ExchangeRate[];
}

export interface PlatformUpdatesExchangeRateParams {
  priceFeedId: string;
  bidPrice: string;
  askPrice: string;
  retrievalDate: Date;
  sourceDate: Date;
}

export interface PlatformUpdatesExchangeRateResult {
  id: string;
  priceFeedId: string;
  bidPrice: string;
  askPrice: string;
  retrievalDate: Date;
  sourceDate: Date;
}

// Account Creation Types
export interface PlatformCreatesUserAccountParams {
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  accountType?: string;
}

export interface PlatformCreatesUserAccountResult {
  id: string;
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  balance: string;
  accountType: string;
}

// Currency Management Types
export interface UserViewsCurrenciesParams {
  type?: 'collateral' | 'loan' | 'all';
  blockchainKey?: string;
  minLtv?: number;
  maxLtv?: number;
}

export interface Blockchain {
  key: string;
  name: string;
  shortName: string;
  image: string;
}

export interface Currency {
  blockchainKey: string;
  tokenId: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl: string;
  isCollateralCurrency: boolean;
  isLoanCurrency: boolean;
  maxLtv: number;
  ltvWarningThreshold: number;
  ltvCriticalThreshold: number;
  ltvLiquidationThreshold: number;
  minLoanPrincipalAmount: string;
  maxLoanPrincipalAmount: string;
  minWithdrawalAmount: string;
  maxWithdrawalAmount: string;
  maxDailyWithdrawalAmount: string;
  withdrawalFeeRate: number;
  blockchain: Blockchain;
}

export interface UserViewsCurrenciesResult {
  currencies: Currency[];
}
