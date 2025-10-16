export interface LoanMatchingCriteria {
  duration: number; // in months
  interest: number; // interest rate as percentage (e.g., 5.5 for 5.5%)
  principalAmount: string; // amount as string for precision
}

/**
 * Enhanced lender criteria supporting the new lender rules
 */
export interface LenderMatchingCriteria {
  // Lender rule 1: Multiple duration options
  durationOptions?: number[]; // e.g., [12, 24, 36] - lenders can offer multiple term choices

  // Lender rule 2: Fixed interest rate
  fixedInterestRate?: number; // e.g., 8.5 - lenders set non-negotiable fixed rates

  // Lender rule 3: Principal amount range (min/max)
  minPrincipalAmount?: string; // minimum loan amount lender will offer
  maxPrincipalAmount?: string; // maximum loan amount lender will offer

  // Additional filtering criteria
  collateralType?: string; // specific collateral types lender accepts
  principalCurrency?: string; // currency lender operates in
}

/**
 * Enhanced borrower criteria for precise loan matching
 */
export interface BorrowerMatchingCriteria {
  // Borrower rule 1: Fixed duration requirement
  fixedDuration?: number; // e.g., 24 - borrower wants exactly 24 months

  // Borrower rule 2: Fixed principal amount requirement
  fixedPrincipalAmount?: string; // e.g., "50000" - borrower wants exactly this amount

  // Borrower rule 3: Maximum acceptable interest rate
  maxInterestRate?: number; // e.g., 8.0 - borrower won't accept rates above this

  // Additional borrower preferences
  preferInstitutionalLenders?: boolean; // prioritize institutions over individuals
  collateralType?: string; // specific collateral borrower wants to use
  principalCurrency?: string; // currency borrower prefers
}

export interface LoanMatchingWorkerData {
  batchSize?: number;

  /** @deprecated Use lenderCriteria and borrowerCriteria for enhanced matching */
  criteria?: LoanMatchingCriteria;

  /** Enhanced lender criteria supporting multiple rules */
  lenderCriteria?: LenderMatchingCriteria;

  /** Enhanced borrower criteria for precise matching */
  borrowerCriteria?: BorrowerMatchingCriteria;

  asOfDate?: string;
  targetApplicationId?: string; // Focus matching on specific application
  targetOfferId?: string; // Focus matching on specific offer
}

export interface MatchedLoanPair {
  loanApplicationId: string;
  loanOfferId: string;
  borrowerUserId: string;
  lenderUserId: string;
  principalAmount: string;
  interestRate: number;
  termInMonths: number;
  collateralValuationAmount: string;
  ltvRatio: number;
  matchedDate: Date;
}

export interface LoanMatchingResult {
  processedApplications: number;
  processedOffers: number;
  matchedPairs: number;
  errors: string[];
  matchedLoans: MatchedLoanPair[];
  hasMore: boolean;
}

/**
 * Type for loan applications used in the matching algorithm
 * Based on PlatformListsMatchableLoanApplicationsResult
 */
export interface MatchableLoanApplication {
  id: string;
  borrowerUserId: string;
  loanOfferId?: string;
  principalCurrency: {
    blockchainKey: string;
    tokenId: string;
    decimals: number;
    symbol: string;
    name: string;
  };
  principalAmount: string;
  maxInterestRate: number;
  termInMonths: number;
  collateralBlockchainKey: string;
  collateralTokenId: string;
  collateralDepositAmount: string;
  principalBlockchainKey: string;
  principalTokenId: string;
  status: string;
  appliedDate: Date;
  expirationDate: Date;
  matchedLoanOfferId?: string;
}

/**
 * Type for loan offers used in the matching algorithm
 * Based on PlatformListsAvailableLoanOffersResult
 */
export interface CompatibleLoanOffer {
  id: string;
  lenderUserId: string;
  availablePrincipalAmount: string;
  minLoanPrincipalAmount: string;
  maxLoanPrincipalAmount: string;
  interestRate: number;
  termInMonthsOptions: number[];
  expirationDate: Date;
  publishedDate: Date;
}
