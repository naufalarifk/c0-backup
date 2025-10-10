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
  currencyName: string;
  currencySymbol: string;
  currencyDecimals: number;
  balance: string;
  accountType: string;
  valuationAmount?: string | null;
  exchangeRate?: string;
  rateSource?: string;
  rateDate?: Date;
  quoteCurrencyDecimals?: number;
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

export interface ActiveInvoiceRecord {
  id: string;
  userId: string;
  walletAddress: string;
  walletDerivationPath: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  accountBlockchainKey?: string | null;
  accountTokenId?: string | null;
  invoiceType: string;
  status: string;
  invoicedAmount: string;
  prepaidAmount: string;
  paidAmount: string;
  dueDate?: Date | null;
  expiredDate?: Date | null;
}

export interface PlatformViewsActiveInvoicesParams {
  blockchainKey?: string;
  limit?: number;
  offset?: number;
}

export interface BlockchainDetectsInvoicePaymentParams {
  walletAddress: string;
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
  blockchainKey: string;
  address: string;
}

export interface UserRegistersWithdrawalBeneficiaryResult {
  id: string;
  userId: string;
  blockchainKey: string;
  address: string;
}

export interface UserRequestsWithdrawalParams {
  beneficiaryId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
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

export interface AdminViewsFailedWithdrawalsParams {
  page?: number;
  limit?: number;
  failureType?: string;
  reviewed?: boolean;
}

export interface AdminFailedWithdrawalItem {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhoneNumber?: string;
  userKycStatus: string;
  amount: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  beneficiaryAddress: string;
  requestDate: string;
  failedDate: string;
  failureReason: string;
  status: string;
  transactionHash?: string;
  networkFee?: string;
  attempts: number;
  lastAttemptDate?: string;
  reviewerId?: string;
  reviewDate?: string;
  reviewDecision?: string;
  reviewReason?: string;
  adminNotes?: string;
}

export interface AdminViewsFailedWithdrawalsResult {
  withdrawals: AdminFailedWithdrawalItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminViewsWithdrawalDetailsParams {
  withdrawalId: string;
}

export interface AdminWithdrawalDetailsResult {
  withdrawal: AdminFailedWithdrawalItem;
  systemContext: {
    failureType: string;
    networkStatus: string;
    platformWalletBalance: string;
    errorLogs: string[];
  };
}

export interface UserViewsWithdrawalBeneficiariesParams {
  userId: string;
}

export interface WithdrawalBeneficiaryListItem {
  id: number;
  userId: string;
  blockchainKey: string;
  address: string;
  label?: string | null;
  createdDate: Date;
  verifiedDate: Date | null;
  isActive: boolean;
  blockchain: Blockchain;
}

export interface UserViewsWithdrawalBeneficiariesResult {
  beneficiaries: WithdrawalBeneficiaryListItem[];
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

// Platform Invoice Expiry Management Types
export interface PlatformViewsActiveButExpiredInvoicesParams {
  asOfDate?: Date;
  limit?: number;
  offset?: number;
}

export interface ActiveButExpiredInvoice {
  id: string;
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  invoicedAmount: string;
  paidAmount: string;
  walletAddress: string;
  walletDerivationPath: string;
  invoiceType: string;
  status: string;
  invoiceDate: Date;
  dueDate: Date | null | undefined;
  expiredDate: Date | null | undefined;
}

export interface PlatformViewsActiveButExpiredInvoicesResult {
  invoices: ActiveButExpiredInvoice[];
  totalCount: number;
  hasMore: boolean;
}

export interface PlatformSetActiveButExpiredInvoiceAsExpiredParams {
  invoiceId: string;
  expiredDate: Date;
}

export interface PlatformSetActiveButExpiredInvoiceAsExpiredResult {
  id: string;
  status: string;
  expiredDate: Date;
}
export interface PlatformRetrievesProvisionRateResult {
  loanProvisionRate: string; // The provision rate as decimal string (e.g., "3.0" for 3.0%)
  effectiveDate: Date;
}

// Withdrawal Retrieval Types
export interface UserViewsWithdrawalsParams {
  userId: string;
  page?: number;
  limit?: number;
  state?: 'requested' | 'sent' | 'confirmed' | 'failed';
}

export interface WithdrawalCurrency {
  blockchainKey: string;
  tokenId: string;
  name: string;
  symbol: string;
  decimals: number;
  logoUrl?: string;
}

export interface WithdrawalBlockchain {
  key: string;
  name: string;
  shortName: string;
  image?: string;
}

export interface WithdrawalBeneficiary {
  id: number;
  blockchainKey: string;
  address: string;
  label?: string;
  createdDate: Date;
  verifiedDate?: Date;
  isActive: boolean;
  blockchain: WithdrawalBlockchain;
}

export interface WithdrawalRecord {
  id: number;
  currency: WithdrawalCurrency;
  beneficiary: WithdrawalBeneficiary;
  requestAmount: string;
  sentAmount?: string;
  networkFee?: string;
  platformFee?: string;
  requestDate: Date;
  sentDate?: Date;
  sentHash?: string;
  confirmedDate?: Date;
  failedDate?: Date;
  failureReason?: string;
  state: string;
  blockchainExplorerUrl?: string;
  estimatedConfirmationTime?: string;
}

export interface WithdrawalPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface UserViewsWithdrawalsResult {
  withdrawals: WithdrawalRecord[];
  pagination: WithdrawalPagination;
}

export interface UserViewsWithdrawalDetailsParams {
  userId: string;
  withdrawalId: string;
}

export interface UserViewsWithdrawalDetailsResult {
  withdrawal: WithdrawalRecord | null;
}

// Portfolio Management Types
export interface UserRetrievesPortfolioAnalyticsParams {
  userId: string;
}

export interface PortfolioAnalyticsResult {
  totalPortfolioValue: {
    amount: string;
    currency: string;
    isLocked: boolean;
    lastUpdated: Date;
  };
  interestGrowth: {
    amount: string;
    currency: string;
    percentage: number;
    isPositive: boolean;
    periodLabel: string;
  };
  activeLoans: {
    count: number;
    borrowerLoans: number;
    lenderLoans: number;
    totalCollateralValue: string;
    averageLTV: number;
  };
  portfolioPeriod: {
    displayMonth: string;
    startDate: Date;
    endDate: Date;
  };
  paymentAlerts: {
    upcomingPayments: PaymentAlert[];
    overduePayments: PaymentAlert[];
  };
  assetBreakdown: {
    cryptoAssets: {
      percentage: number;
      value: string;
    };
    stablecoins: {
      percentage: number;
      value: string;
    };
    loanCollateral: {
      percentage: number;
      value: string;
    };
  };
}

export interface PaymentAlert {
  loanId: string;
  daysUntilDue: number;
  paymentAmount: string;
  currency: string;
  collateralAtRisk: string;
  collateralCurrency: string;
  liquidationWarning: boolean;
}

export interface UserRetrievesPortfolioOverviewParams {
  userId: string;
}

export interface PortfolioOverviewResult {
  totalValue: {
    amount: string;
    currency: Currency;
  };
  assetAllocation: AssetAllocation[];
  performance: {
    daily: PerformanceMetric;
    weekly: PerformanceMetric;
    monthly: PerformanceMetric;
  };
  lastUpdated: Date;
}

export interface AssetAllocation {
  currency: Currency;
  balance: string;
  value: {
    amount: string;
    currency: string;
  };
  percentage: number;
}

export interface PerformanceMetric {
  amount: string;
  currency: string;
  percentage: number;
}

// Withdrawal Status and Limit Management Types
export interface GetRemainingDailyWithdrawalLimitParams {
  userId: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
}

export interface GetRemainingDailyWithdrawalLimitResult {
  remainingLimit: string;
  dailyLimit: string;
  usedToday: string;
}

export interface GetWithdrawalStatusParams {
  withdrawalId: string;
}

export interface GetWithdrawalStatusResult {
  status: string;
}

export interface UpdateWithdrawalStatusParams {
  withdrawalId: string;
  status: string;
  refundRequestedDate?: Date;
}

export interface UpdateWithdrawalStatusResult {
  id: string;
  status: string;
}

// Finance Configuration Types
export interface UserViewsBlockchainsParams {
  // No parameters needed - returns all supported blockchains
}

export interface UserViewsBlockchainsResult {
  blockchains: Blockchain[];
}
