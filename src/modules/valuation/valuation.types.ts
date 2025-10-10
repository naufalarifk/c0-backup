// Valuation event types and schemas

export type ExchangeRateUpdatedEvent = {
  exchangeRateId: string;
  priceFeedId: string;
  blockchainKey: string;
  baseCurrencyTokenId: string;
  quoteCurrencyTokenId: string;
  bidPrice: string;
  askPrice: string;
  retrievalDate: Date;
  sourceDate: Date;
};

export type LtvWarningLevel = 'warning1' | 'warning2' | 'warning3' | 'riskPremium' | 'liquidation';

export type LtvThresholdBreachedEvent = {
  loanId: string;
  borrowerUserId: string;
  currentLtvRatio: number;
  thresholdLevel: LtvWarningLevel;
  collateralValuationAmount: string;
  totalDebtAmount: string;
  collateralCurrency: {
    blockchainKey: string;
    tokenId: string;
    symbol: string;
  };
  principalCurrency: {
    blockchainKey: string;
    tokenId: string;
    symbol: string;
  };
  breachDate: Date;
  exchangeRateId: string;
};

export type LoanMaturityReminderEvent = {
  loanId: string;
  borrowerUserId: string;
  maturityDate: Date;
  daysUntilMaturity: number;
  totalRepaymentAmount: string;
  principalCurrency: {
    blockchainKey: string;
    tokenId: string;
    symbol: string;
  };
};

export type ActiveLoanForValuation = {
  loanId: string;
  borrowerUserId: string;
  collateralBlockchainKey: string;
  collateralTokenId: string;
  collateralAmount: string;
  collateralDecimals: number;
  principalBlockchainKey: string;
  principalTokenId: string;
  principalAmount: string;
  interestAmount: string;
  provisionAmount: string;
  principalDecimals: number;
  currentLtvRatio: number;
  mcLtvRatio: number;
  maturityDate: Date;
  lastWarningLevel?: LtvWarningLevel;
};

export type ValuationCalculationResult = {
  loanId: string;
  exchangeRateId: string;
  valuationDate: Date;
  collateralValuationAmount: string;
  newLtvRatio: number;
  previousLtvRatio: number;
  totalDebtAmount: string;
  breachedThresholds: LtvWarningLevel[];
};
