// Reuse generic types from user.types.ts
import type { NotificationType, PaginationMeta } from './user.types';

// Common loan-related types
export type Currency = {
  blockchainKey: string;
  tokenId: string;
  decimals: number;
  symbol: string;
  name: string;
};

// Data-only repository operation types (without business logic)
export type BorrowerGetsCurrencyPairParams = {
  collateralBlockchainKey: string;
  collateralTokenId: string;
  principalBlockchainKey: string;
  principalTokenId: string;
};

export type BorrowerGetsCurrencyPairResult = {
  principalCurrency: Currency;
  collateralCurrency: Currency;
};

export type BorrowerGetsPlatformConfigParams = {
  effectiveDate: Date;
};

export type BorrowerGetsPlatformConfigResult = {
  loanProvisionRate: string | number;
  loanMinLtvRatio: string | number;
  loanMaxLtvRatio: string | number;
};

export type BorrowerGetsExchangeRateParams = {
  collateralBlockchainKey?: string;
  collateralTokenId: string;
  asOfDate?: Date;
};

export type BorrowerGetsExchangeRateResult = {
  id: string | number;
  bidPrice: string;
  askPrice: string;
  sourceDate: Date;
};

export type BorrowerCreatesLoanApplicationParams = {
  borrowerUserId: string;
  loanOfferId?: string;
  collateralBlockchainKey: string;
  collateralTokenId: string;
  principalBlockchainKey: string;
  principalTokenId: string;
  principalAmount: string; // In smallest units
  provisionAmount: string; // Pre-calculated in smallest units
  maxInterestRate: number;
  minLtvRatio: number; // Pre-calculated decimal
  maxLtvRatio: number; // Pre-calculated decimal
  termInMonths: number;
  liquidationMode: LiquidationMode;
  collateralDepositAmount: string; // Pre-calculated in smallest units
  collateralDepositExchangeRateId: string | number;
  appliedDate: Date;
  expirationDate: Date;
  collateralInvoiceId: number;
  collateralInvoicePrepaidAmount: string;
  collateralAccountBlockchainKey?: string;
  collateralAccountTokenId?: string;
  collateralInvoiceDate: Date;
  collateralInvoiceDueDate: Date;
  collateralInvoiceExpiredDate: Date;
  collateralWalletDerivationPath: string;
  collateralWalletAddress: string;
};

export type BorrowerCreatesLoanApplicationResult = {
  id: string;
  borrowerUserId: string;
  loanOfferId?: string;
  principalCurrency: Currency;
  principalAmount: string;
  provisionAmount: string;
  maxInterestRate: number;
  minLtvRatio: number;
  maxLtvRatio: number;
  termInMonths: number;
  liquidationMode: LiquidationMode;
  collateralCurrency: Currency;
  collateralDepositAmount: string;
  collateralDepositExchangeRateId: string | number;
  appliedDate: Date;
  expirationDate: Date;
  collateralInvoice: Invoice;
  collateralDepositInvoice: Invoice; // Alias for backward compatibility
  status: LoanApplicationStatus;
  loanApplicationStatus: LoanApplicationStatus; // Keep both for compatibility
};

export type Invoice = {
  id: string;
  amount: string;
  currency: Currency;
  status: 'Pending' | 'Paid' | 'Expired' | 'Cancelled';
  createdDate: Date;
  expiryDate: Date;
  paidDate?: Date;
};

export type LoanOfferStatus = 'Funding' | 'Published' | 'Closed' | 'Expired';
export type LoanApplicationStatus =
  | 'PendingCollateral'
  | 'Published'
  | 'Matched'
  | 'Cancelled'
  | 'Closed'
  | 'Expired';
export type LoanStatus = 'Originated' | 'Active' | 'Liquidated' | 'Repaid' | 'Defaulted';
export type LiquidationMode = 'Partial' | 'Full';
export type LiquidationStatus = 'Pending' | 'Fulfilled' | 'Failed';
export type RepaymentInitiator = 'Borrower' | 'Platform';
export type LiquidationInitiator = 'Borrower' | 'Platform';

// Loan Offer Types
export type LenderCreatesLoanOfferParams = {
  lenderUserId: string;
  principalBlockchainKey: string;
  principalTokenId: string;
  offeredPrincipalAmount: string;
  minLoanPrincipalAmount: string;
  maxLoanPrincipalAmount: string;
  interestRate: number; // 0-100 decimal
  termInMonthsOptions: number[];
  expirationDate: Date;
  createdDate: Date;
  fundingInvoiceId: number;
  fundingInvoicePrepaidAmount: string;
  fundingAccountBlockchainKey?: string;
  fundingAccountTokenId?: string;
  fundingInvoiceDate: Date;
  fundingInvoiceDueDate: Date;
  fundingInvoiceExpiredDate: Date;
  fundingWalletDerivationPath: string;
  fundingWalletAddress: string;
};

export type LenderCreatesLoanOfferResult = {
  id: string;
  lenderUserId: string;
  lenderUserType: 'Individual' | 'Institution';
  lenderUserName: string;
  lenderProfilePictureUrl?: string;
  lenderBusinessType?: string;
  lenderBusinessDescription?: string;
  principalCurrency: Currency;
  offeredPrincipalAmount: string;
  availablePrincipalAmount: string;
  minLoanPrincipalAmount: string;
  maxLoanPrincipalAmount: string;
  interestRate: number;
  termInMonthsOptions: number[];
  status: LoanOfferStatus;
  createdDate: Date;
  expirationDate: Date;
  fundingInvoice: Invoice;
};

export type LenderClosesLoanOfferParams = {
  loanOfferId: string;
  lenderUserId: string;
  closedDate: Date;
  closureReason?: string;
};

export type LenderClosesLoanOfferResult = {
  id: string;
  status: LoanOfferStatus;
  closedDate: Date;
  closureReason?: string;
};

export type LenderViewsMyLoanOffersParams = {
  lenderUserId: string;
  page?: number;
  limit?: number;
  status?: LoanOfferStatus;
};

export type LenderViewsMyLoanOffersResult = {
  loanOffers: Array<{
    id: string;
    lenderUserName?: string;
    lenderUserType?: string;
    principalCurrency: Currency;
    offeredPrincipalAmount: string;
    availablePrincipalAmount: string;
    disbursedPrincipalAmount: string;
    reservedPrincipalAmount: string;
    minLoanPrincipalAmount: string;
    maxLoanPrincipalAmount: string;
    interestRate: number;
    termInMonthsOptions: number[];
    status: LoanOfferStatus;
    createdDate: Date;
    expirationDate: Date;
    publishedDate?: Date;
    closedDate?: Date;
    closureReason?: string;
  }>;
  pagination: PaginationMeta;
};

export type PlatformListsAvailableLoanOffersParams = {
  collateralBlockchainKey?: string;
  collateralTokenId?: string;
  principalBlockchainKey?: string;
  principalTokenId?: string;
  page?: number;
  limit?: number;
};

export type PlatformListsAvailableLoanOffersResult = {
  loanOffers: Array<{
    id: string;
    lenderUserId: string;
    lenderUserName?: string;
    lenderUserType?: string;
    principalCurrency: Currency;
    availablePrincipalAmount: string;
    minLoanPrincipalAmount: string;
    maxLoanPrincipalAmount: string;
    interestRate: number;
    termInMonthsOptions: number[];
    expirationDate: Date;
    publishedDate: Date;
  }>;
  pagination: PaginationMeta;
};

export type PlatformListsAvailableLoanApplicationsParams = {
  collateralBlockchainKey?: string;
  collateralTokenId?: string;
  principalBlockchainKey?: string;
  principalTokenId?: string;
  minPrincipalAmount?: number;
  maxPrincipalAmount?: number;
  liquidationMode?: string;
  page?: number;
  limit?: number;
};

export type PlatformListsMatchableLoanApplicationsParams = {
  page?: number;
  limit?: number;
};

export type PlatformListsMatchableLoanApplicationsResult = {
  loanApplications: Array<{
    id: string;
    borrowerUserId: string;
    loanOfferId?: string;
    principalCurrency: Currency;
    principalAmount: string;
    maxInterestRate: number;
    termInMonths: number;
    collateralBlockchainKey: string;
    collateralTokenId: string;
    collateralDepositAmount: string;
    principalBlockchainKey: string;
    principalTokenId: string;
    status: LoanApplicationStatus;
    appliedDate: Date;
    expirationDate: Date;
    matchedLoanOfferId?: string;
  }>;
  pagination: PaginationMeta;
};

// Loan Application Types
export type BorrowerCalculatesLoanRequirementsParams = {
  collateralBlockchainKey: string;
  collateralTokenId: string;
  principalBlockchainKey: string;
  principalTokenId: string;
  principalAmount: string;
  termInMonths: number;
  calculationDate: Date;
};

export type PlatformListsAvailableLoanApplicationsResult = {
  loanApplications: Array<{
    id: string;
    borrowerUserId: string;
    borrower: {
      id: string;
      type: 'Individual' | 'Institution';
      name: string;
    };
    collateralCurrency: Currency;
    principalCurrency: Currency;
    principalAmount: string;
    maxInterestRate: number;
    termInMonths: number;
    liquidationMode: LiquidationMode;
    status: LoanApplicationStatus;
    appliedDate: Date;
    publishedDate?: Date;
    expirationDate: Date;
  }>;
  pagination: PaginationMeta;
};

// Loan Application Types (legacy definitions now moved above)

export type BorrowerUpdatesLoanApplicationParams = {
  loanApplicationId: string;
  borrowerUserId: string;
  action: 'cancel' | 'modify';
  updateDate: Date;
  expirationDate?: Date;
  closureReason?: string;
};

export type BorrowerUpdatesLoanApplicationResult = {
  id: string;
  status: LoanApplicationStatus;
  updatedDate: Date;
  expirationDate?: Date;
  closureReason?: string;
};

export type BorrowerViewsMyLoanApplicationsParams = {
  borrowerUserId: string;
  page?: number;
  limit?: number;
  status?: LoanApplicationStatus;
};

export type BorrowerViewsMyLoanApplicationsResult = {
  loanApplications: Array<{
    id: string;
    loanOfferId?: string;
    principalCurrency: Currency;
    principalAmount: string;
    provisionAmount: string;
    maxInterestRate: number;
    minLtvRatio: number;
    maxLtvRatio: number;
    termInMonths: number;
    liquidationMode: LiquidationMode;
    collateralCurrency: Currency;
    collateralDepositAmount: string;
    status: LoanApplicationStatus;
    appliedDate: Date;
    expirationDate: Date;
    publishedDate?: Date;
    matchedDate?: Date;
    matchedLoanOfferId?: string;
    closedDate?: Date;
    closureReason?: string;
  }>;
  pagination: PaginationMeta;
};

// Loan Matching Types
export type PlatformMatchesLoanOffersParams = {
  loanApplicationId: string;
  loanOfferId: string;
  matchedDate: Date;
  matchedLtvRatio: number;
  matchedCollateralValuationAmount: string;
};

export type PlatformMatchesLoanOffersResult = {
  loanApplicationId: string;
  loanOfferId: string;
  matchedDate: Date;
  matchedLtvRatio: number;
  matchedCollateralValuationAmount: string;
};

// Loan Management Types
export type PlatformOriginatesLoanParams = {
  loanOfferId: string;
  loanApplicationId: string;
  principalAmount: string;
  interestAmount: string;
  repaymentAmount: string;
  redeliveryFeeAmount: string;
  redeliveryAmount: string;
  premiAmount: string;
  liquidationFeeAmount: string;
  minCollateralValuation: string;
  mcLtvRatio: number;
  collateralAmount: string;
  legalDocumentPath?: string;
  legalDocumentHash?: string;
  originationDate: Date;
  maturityDate: Date;
};

export type PlatformOriginatesLoanResult = {
  id: string;
  loanOfferId: string;
  loanApplicationId: string;
  principalCurrency: Currency;
  principalAmount: string;
  interestAmount: string;
  repaymentAmount: string;
  collateralCurrency: Currency;
  collateralAmount: string;
  status: LoanStatus;
  originationDate: Date;
  maturityDate: Date;
  mcLtvRatio: number;
  legalDocumentPath?: string;
};

export type PlatformDisbursesPrincipalParams = {
  loanId: string;
  disbursementDate: Date;
};

export type PlatformDisbursesPrincipalResult = {
  id: string;
  status: LoanStatus;
  disbursementDate: Date;
};

export type UserViewsLoansParams = {
  userId: string;
  role?: 'borrower' | 'lender'; // Filter by user role in loan
  page?: number;
  limit?: number;
  status?: LoanStatus;
};

export type UserViewsLoansResult = {
  loans: Array<{
    id: string;
    loanOfferId: string;
    loanApplicationId: string;
    borrowerUserId: string;
    lenderUserId: string;
    principalCurrency: Currency;
    principalAmount: string;
    interestAmount: string;
    repaymentAmount: string;
    collateralCurrency: Currency;
    collateralAmount: string;
    status: LoanStatus;
    originationDate: Date;
    disbursementDate?: Date;
    maturityDate: Date;
    concludedDate?: Date;
    currentLtvRatio?: number;
    mcLtvRatio: number;
    interestRate: number;
    termInMonths: number;
  }>;
  pagination: PaginationMeta;
};

export type UserViewsLoanDetailsParams = {
  loanId: string;
  userId: string;
};

export type UserViewsLoanDetailsResult = {
  id: string;
  loanOfferId: string;
  loanApplicationId: string;
  borrowerUserId: string;
  lenderUserId: string;
  principalCurrency: Currency;
  principalAmount: string;
  interestAmount: string;
  repaymentAmount: string;
  redeliveryFeeAmount: string;
  redeliveryAmount: string;
  premiAmount: string;
  liquidationFeeAmount: string;
  minCollateralValuation: string;
  collateralCurrency: Currency;
  collateralAmount: string;
  status: LoanStatus;
  originationDate: Date;
  disbursementDate?: Date;
  maturityDate: Date;
  concludedDate?: Date;
  conclusionReason?: string;
  currentLtvRatio?: number;
  mcLtvRatio: number;
  mcLtvRatioDate?: Date;
  legalDocumentPath?: string;
  legalDocumentHash?: string;
  legalDocumentCreatedDate?: Date;
};

// Loan Valuation Types
export type PlatformUpdatesLoanValuationsParams = {
  loanId: string;
  exchangeRateId: string;
  valuationDate: Date;
  ltvRatio: number;
  collateralValuationAmount: string;
};

export type PlatformUpdatesLoanValuationsResult = {
  loanId: string;
  exchangeRateId: string;
  valuationDate: Date;
  ltvRatio: number;
  collateralValuationAmount: string;
};

export type UserViewsLoanValuationHistoryParams = {
  loanId: string;
  userId: string;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
};

export type UserViewsLoanValuationHistoryResult = {
  success: boolean;
  data: Array<{
    loanId: string;
    exchangeRateId: string;
    valuationDate: Date;
    ltvRatio: number;
    collateralValuationAmount: string;
    collateralCurrency: Currency;
    principalCurrency: Currency;
    ltvChange?: number; // Percentage change from previous valuation
  }>;
  pagination?: PaginationMeta;
};

export type PlatformMonitorsLtvRatiosParams = {
  monitoringDate: Date;
  ltvThreshold?: number; // Optional threshold override
};

export type PlatformMonitorsLtvRatiosResult = {
  processedLoans: number;
  breachedLoans: Array<{
    loanId: string;
    borrowerUserId: string;
    currentLtvRatio: number;
    mcLtvRatio: number;
    breachDate: Date;
  }>;
};

// Loan Repayment Types
export type BorrowerRepaysLoanParams = {
  loanId: string;
  borrowerUserId: string;
  repaymentDate: Date;
  repaymentWalletDerivationPath: string;
  repaymentWalletAddress: string;
};

export type BorrowerRepaysLoanResult = {
  id: string;
  status: LoanStatus;
  repaymentInvoice: Invoice;
  concludedDate: Date;
};

export type BorrowerRequestsEarlyRepaymentParams = {
  loanId: string;
  borrowerUserId: string;
  acknowledgment: string | boolean;
  requestDate: Date;
  repaymentWalletDerivationPath: string;
  repaymentWalletAddress: string;
};

export type BorrowerRequestsEarlyRepaymentResult = {
  success: boolean;
  message: string;
  data: {
    loanId: string;
    repaymentBreakdown: {
      loanDetails: {
        principalAmount: string;
        interestAmount: string;
        premiAmount: string;
        totalRepaymentAmount: string;
      };
      calculationDetails: {
        fullInterestCharged: boolean;
        remainingTermDays: number;
        earlyRepaymentDate: Date;
      };
    };
    repaymentInvoice: Invoice;
  };
};

// Early Liquidation Types
export type BorrowerRequestsEarlyLiquidationEstimateParams = {
  loanId: string;
  borrowerUserId: string;
  estimateDate: Date;
};

export type BorrowerRequestsEarlyLiquidationEstimateResult = {
  success: boolean;
  data: {
    loanId: string;
    liquidationBreakdown: {
      outstandingLoan: {
        principalAmount: string;
        interestAmount: string;
        premiAmount: string;
        liquidationFeeAmount: string;
        totalOutstandingAmount: string;
      };
      collateralValuation: {
        collateralCurrency: Currency;
        currentCollateralAmount: string;
        currentValuationAmount: string;
        currentLtvRatio: number;
        estimatedLiquidationAmount: string;
        estimatedSurplusDeficit: string;
      };
      calculationDetails: {
        exchangeRateId: string;
        valuationDate: Date;
        liquidationMode: LiquidationMode;
        marketProvider?: string;
        estimatedSlippage: number;
      };
    };
  };
};

export type BorrowerRequestsEarlyLiquidationParams = {
  loanId: string;
  borrowerUserId: string;
  acknowledgment: boolean | string;
  requestDate: Date;
};

export type BorrowerRequestsEarlyLiquidationResult = {
  success: boolean;
  message: string;
  data: {
    loanId: string;
    liquidationRequestDate: Date;
    liquidationStatus: LiquidationStatus;
  };
};

export type PlatformUpdatesLiquidationTargetAmountParams = {
  loanId: string;
  liquidationTargetAmount: string; // Pre-calculated in smallest units by service layer
};

export type PlatformUpdatesLiquidationTargetAmountResult = {
  loanId: string;
  liquidationTargetAmount: string;
};

export type BorrowerGetsLoanAmountsParams = {
  loanId: string;
  borrowerUserId: string;
};

export type BorrowerGetsLoanAmountsResult = {
  loanId: string;
  repaymentAmount: string;
  premiAmount: string;
  liquidationFeeAmount: string;
  principalAmount: string;
  interestAmount: string;
  status: string;
};

// Platform Liquidation Types
export type PlatformLiquidatesCollateralParams = {
  loanId: string;
  liquidationTargetAmount: string;
  marketProvider: string;
  marketSymbol: string;
  orderRef: string;
  orderQuantity: string;
  orderPrice: string;
  orderDate: Date;
  liquidationInitiator: LiquidationInitiator;
};

export type PlatformLiquidatesCollateralResult = {
  loanId: string;
  liquidationStatus: LiquidationStatus;
  orderRef: string;
  orderDate: Date;
  liquidationTargetAmount: string;
};
