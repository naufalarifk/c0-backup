/**
 * Comprehensive API Mock Data for Loan Management System
 * Based on SRS-CG-v2.3-EN requirements, OpenAPI specifications, and PostgreSQL schemas
 */

// =============================================================================
// BASE MOCK ENTITIES
// =============================================================================

export const mockCurrencies = {
  // Collateral currencies
  btc: {
    currencyBlockchainKey: "bip122:000000000019d6689c085ae165831e93",
    currencyTokenId: "slip44:0",
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 8,
    logoUrl: "https://cryptologos.cc/logos/bitcoin-btc-logo.png"
  },
  eth: {
    currencyBlockchainKey: "eip155:1",
    currencyTokenId: "slip44:60", 
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    logoUrl: "https://cryptologos.cc/logos/ethereum-eth-logo.png"
  },
  bnb: {
    currencyBlockchainKey: "eip155:56",
    currencyTokenId: "slip44:714",
    name: "Binance Coin",
    symbol: "BNB", 
    decimals: 18,
    logoUrl: "https://cryptologos.cc/logos/bnb-bnb-logo.png"
  },
  sol: {
    currencyBlockchainKey: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
    currencyTokenId: "slip44:501",
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    logoUrl: "https://cryptologos.cc/logos/solana-sol-logo.png"
  },
  // Principal currency
  usdt_bsc: {
    currencyBlockchainKey: "eip155:56",
    currencyTokenId: "erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
    name: "Binance-Peg USD Coin",
    symbol: "USDC",
    decimals: 18,
    logoUrl: "https://cryptologos.cc/logos/tether-usdt-logo.png"
  }
} as const;

export const mockLoanOffers = {
  // Active published offer - BTC collateral
  btcOfferPublished: {
    id: "lof_clx8k3m4n0001w9g5h9s2c8y4",
    lenderId: "usr_clx7k2m3n0003w8g4h9s1c7y5", // Institution owner
    principalCurrency: "USDC-BSC",
    totalAmount: "50000.000000000000000000",
    availableAmount: "35000.000000000000000000",
    disbursedAmount: "15000.000000000000000000",
    interestRate: 12.5,
    termOptions: [3, 6, 12],
    status: "published",
    createdDate: "2024-03-01T10:30:00.000Z",
    publishedDate: "2024-03-01T11:15:00.000Z",
    fundingInvoice: {
      id: "inv_clx8k3m4n0002w9g5h9s2c8y5",
      amount: "50000.000000000000000000",
      currency: mockCurrencies.usdt_bsc,
      walletAddress: "0x742d35Cc6634C0532925a3b8D54C9D6F5d4C9A8A",
      expiryDate: "2024-03-10T11:15:00.000Z",
      paidDate: "2024-03-01T11:15:00.000Z",
      expiredDate: null
    }
  },

  // Funding offer - ETH collateral  
  ethOfferFunding: {
    id: "lof_clx8k3m4n0003w9g5h9s2c8y6",
    lenderId: "usr_clx7k2m3n0002w8g4h9s1c7y4", // Individual verified
    principalCurrency: "USDC-BSC",
    totalAmount: "10000.000000000000000000", 
    availableAmount: "0.000000000000000000",
    disbursedAmount: "0.000000000000000000",
    interestRate: 15.0,
    termOptions: [1, 3],
    status: "draft",
    createdDate: "2024-03-10T14:20:00.000Z",
    publishedDate: null,
    fundingInvoice: {
      id: "inv_clx8k3m4n0004w9g5h9s2c8y7",
      amount: "10000.000000000000000000",
      currency: mockCurrencies.usdt_bsc,
      walletAddress: "0x8B3d70dF9c4a93a4527a9B88C3B05F8C91a1A2B3",
      expiryDate: "2024-03-17T14:20:00.000Z",
      paidDate: null,
      expiredDate: null
    }
  },

  // Closed offer
  solOfferClosed: {
    id: "lof_clx8k3m4n0005w9g5h9s2c8y8",
    lenderId: "usr_clx7k2m3n0003w8g4h9s1c7y5", // Institution owner
    principalCurrency: "USDC-BSC", 
    totalAmount: "25000.000000000000000000",
    availableAmount: "0.000000000000000000",
    disbursedAmount: "25000.000000000000000000",
    interestRate: 18.0,
    termOptions: [6],
    status: "closed",
    createdDate: "2024-02-15T09:45:00.000Z", 
    publishedDate: "2024-02-15T10:30:00.000Z",
    fundingInvoice: {
      id: "inv_clx8k3m4n0006w9g5h9s2c8y9",
      amount: "25000.000000000000000000",
      currency: mockCurrencies.usdt_bsc,
      walletAddress: "0x9C4e81Ef0c3b94b5538f7Ec82C2D1E4A9B1C2D3F",
      expiryDate: "2024-02-22T10:30:00.000Z",
      paidDate: "2024-02-15T10:30:00.000Z", 
      expiredDate: null
    }
  }
} as const;

export const mockLoanApplications = {
  // Published application - BTC collateral
  btcApplicationPublished: {
    id: "lap_clx9k4m5n0001wa6h6a3d9z5",
    borrowerId: "usr_clx7k2m3n0001w8g4h9s1c7y3", // Individual pending
    collateralCurrency: "BTC",
    principalAmount: "15000.000000000000000000",
    maxInterestRate: 14.0,
    termMonths: 6,
    liquidationMode: "partial",
    minLtvRatio: 0.45,
    status: "published",
    createdDate: "2024-03-05T11:20:00.000Z",
    publishedDate: "2024-03-05T12:45:00.000Z",
    expiryDate: "2024-03-19T11:20:00.000Z",
    collateralInvoice: {
      id: "inv_clx9k4m5n0002wa6h6a3d9z6", 
      amount: "0.625000000000000000", // ~25000 USD worth of BTC at 40k price
      currency: mockCurrencies.btc,
      walletAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      expiryDate: "2024-03-12T12:45:00.000Z",
      paidDate: "2024-03-05T12:45:00.000Z",
      expiredDate: null
    }
  },

  // Pending collateral application
  ethApplicationPending: {
    id: "lap_clx9k4m5n0003wa6h6a3d9z7",
    borrowerId: "usr_clx7k2m3n0004w8g4h9s1c7y6", // Institution member 
    collateralCurrency: "ETH",
    principalAmount: "8000.000000000000000000",
    maxInterestRate: 16.0,
    termMonths: 3,
    liquidationMode: "full",
    minLtvRatio: 0.50,
    status: "draft",
    createdDate: "2024-03-12T16:30:00.000Z",
    publishedDate: null,
    expiryDate: "2024-03-26T16:30:00.000Z",
    collateralInvoice: {
      id: "inv_clx9k4m5n0004wa6h6a3d9z8",
      amount: "5.714285714285714286", // ~11.4k USD worth of ETH at 2k price  
      currency: mockCurrencies.eth,
      walletAddress: "0x742d35Cc6634C0532925a3b8D54C9D6F5d4C9A8A",
      expiryDate: "2024-03-19T16:30:00.000Z", 
      paidDate: null,
      expiredDate: null
    }
  },

  // Matched application
  bnbApplicationMatched: {
    id: "lap_clx9k4m5n0005wa6h6a3d9z9",
    borrowerId: "usr_clx7k2m3n0002w8g4h9s1c7y4", // Individual verified
    collateralCurrency: "BNB", 
    principalAmount: "5000.000000000000000000",
    maxInterestRate: 20.0,
    termMonths: 1,
    liquidationMode: "partial",
    minLtvRatio: 0.30,
    status: "matched",
    createdDate: "2024-03-08T13:15:00.000Z",
    publishedDate: "2024-03-08T14:00:00.000Z", 
    expiryDate: "2024-03-22T13:15:00.000Z",
    collateralInvoice: {
      id: "inv_clx9k4m5n0006wa6h6a3d9za",
      amount: "41.666666666666666667", // ~16.7k USD worth of BNB at 400 price
      currency: mockCurrencies.bnb,
      walletAddress: "0x8B3d70dF9c4a93a4527a9B88C3B05F8C91a1A2B3",
      expiryDate: "2024-03-15T14:00:00.000Z",
      paidDate: "2024-03-08T14:00:00.000Z",
      expiredDate: null
    }
  }
} as const;

export const mockLoans = {
  // Active loan - BTC collateral
  btcLoanActive: {
    id: "lon_clxak5m6n0001wb7i7b4eaz6",
    borrowerId: "usr_clx7k2m3n0001w8g4h9s1c7y3", // Individual pending
    lenderId: "usr_clx7k2m3n0003w8g4h9s1c7y5", // Institution owner
    principalAmount: "15000.000000000000000000",
    collateralAmount: "0.625000000000000000", // 0.625 BTC
    interestRate: 12.5,
    termMonths: 6,
    currentLtv: 0.52,
    maxLtvRatio: 0.60,
    status: "active",
    originationDate: "2024-03-05T15:20:00.000Z",
    disbursementDate: "2024-03-05T15:30:00.000Z", 
    maturityDate: "2024-09-05T15:30:00.000Z",
    repaidDate: null,
    liquidationDate: null
  },

  // Repaid loan - ETH collateral
  ethLoanRepaid: {
    id: "lon_clxak5m6n0002wb7i7b4eaz7",
    borrowerId: "usr_clx7k2m3n0002w8g4h9s1c7y4", // Individual verified
    lenderId: "usr_clx7k2m3n0003w8g4h9s1c7y5", // Institution owner
    principalAmount: "10000.000000000000000000",
    collateralAmount: "7.142857142857142857", // ~14.3k USD worth of ETH 
    interestRate: 15.0,
    termMonths: 3,
    currentLtv: 0.00,
    maxLtvRatio: 0.70,
    status: "repaid",
    originationDate: "2024-01-15T10:45:00.000Z",
    disbursementDate: "2024-01-15T11:00:00.000Z",
    maturityDate: "2024-04-15T11:00:00.000Z",
    repaidDate: "2024-04-10T09:30:00.000Z", // Early repayment
    liquidationDate: null
  },

  // Liquidated loan - SOL collateral
  solLoanLiquidated: {
    id: "lon_clxak5m6n0003wb7i7b4eaz8", 
    borrowerId: "usr_clx7k2m3n0004w8g4h9s1c7y6", // Institution member
    lenderId: "usr_clx7k2m3n0002w8g4h9s1c7y4", // Individual verified
    principalAmount: "8000.000000000000000000",
    collateralAmount: "200.000000000000000000", // 200 SOL at $80 = $16k
    interestRate: 18.0,
    termMonths: 6,
    currentLtv: 0.75, // Breached liquidation threshold
    maxLtvRatio: 0.50,
    status: "liquidated",
    originationDate: "2024-02-01T14:20:00.000Z",
    disbursementDate: "2024-02-01T14:35:00.000Z",
    maturityDate: "2024-08-01T14:35:00.000Z",
    repaidDate: null,
    liquidationDate: "2024-03-01T10:15:00.000Z"
  }
} as const;

export const mockLoanValuations = [
  // BTC loan valuations - trending up  
  {
    id: "val_clxbk6m7n0001wc8j8c5fbza",
    loanId: "lon_clxak5m6n0001wb7i7b4eaz6",
    valuationDate: "2024-03-05T15:30:00.000Z",
    ltvRatio: 0.60, // Initial LTV
    collateralValue: "25000.000000000000000000", // 0.625 BTC * $40k
    exchangeRate: "40000.000000000000000000"
  },
  {
    id: "val_clxbk6m7n0002wc8j8c5fbzb",
    loanId: "lon_clxak5m6n0001wb7i7b4eaz6", 
    valuationDate: "2024-03-10T12:00:00.000Z",
    ltvRatio: 0.52, // LTV improved as BTC price increased
    collateralValue: "28750.000000000000000000", // 0.625 BTC * $46k
    exchangeRate: "46000.000000000000000000"
  },

  // SOL loan valuations - trending down to liquidation
  {
    id: "val_clxbk6m7n0003wc8j8c5fbzc",
    loanId: "lon_clxak5m6n0003wb7i7b4eaz8",
    valuationDate: "2024-02-01T14:35:00.000Z", 
    ltvRatio: 0.50, // Initial LTV
    collateralValue: "16000.000000000000000000", // 200 SOL * $80
    exchangeRate: "80.000000000000000000"
  },
  {
    id: "val_clxbk6m7n0004wc8j8c5fbzd",
    loanId: "lon_clxak5m6n0003wb7i7b4eaz8",
    valuationDate: "2024-02-28T08:00:00.000Z",
    ltvRatio: 0.75, // LTV breached liquidation threshold
    collateralValue: "10667.000000000000000000", // 200 SOL * $53.335
    exchangeRate: "53.335000000000000000"
  }
] as const;

// =============================================================================
// LOAN OFFER API MOCKS
// =============================================================================

export const loanOfferMocks = {
  // Create loan offer
  createLoanOffer: {
    request: {
      principalBlockchainKey: "eip155:56",
      principalTokenId: "erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      totalAmount: "50000.000000000000000000",
      acceptedCollaterals: [
        {
          currencyBlockchainKey: "bip122:000000000019d6689c085ae165831e93",
          currencyTokenId: "slip44:0"
        },
        {
          currencyBlockchainKey: "eip155:1", 
          currencyTokenId: "slip44:60"
        }
      ],
      interestRate: 12.5,
      termOptions: [3, 6, 12],
      minLoanAmount: "5000.000000000000000000",
      maxLoanAmount: "25000.000000000000000000",
      liquidationMode: "partial"
    },
    response: {
      success: true,
      data: mockLoanOffers.btcOfferPublished
    }
  },

  // List available loan offers
  listLoanOffers: {
    response: {
      success: true,
      data: {
        offers: [
          mockLoanOffers.btcOfferPublished,
          {
            ...mockLoanOffers.ethOfferFunding,
            status: "published" // Override for listing
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Get my loan offers
  getMyLoanOffers: {
    response: {
      success: true,
      data: {
        offers: [
          mockLoanOffers.btcOfferPublished,
          mockLoanOffers.ethOfferFunding,
          mockLoanOffers.solOfferClosed
        ],
        pagination: {
          page: 1,
          limit: 20, 
          total: 3,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Update loan offer - pause
  pauseLoanOffer: {
    request: {
      action: "pause"
    },
    response: {
      success: true,
      data: {
        ...mockLoanOffers.btcOfferPublished,
        status: "paused"
      }
    }
  },

  // Update loan offer - close
  closeLoanOffer: {
    request: {
      action: "close",
      closureReason: "No longer interested in lending"
    },
    response: {
      success: true,
      data: {
        ...mockLoanOffers.btcOfferPublished,
        status: "closed",
        closure_reason: "No longer interested in lending"
      }
    }
  },

  // Validation errors
  createLoanOfferValidationError: {
    request: {
      principalBlockchainKey: "invalid_blockchain",
      principalTokenId: "",
      totalAmount: "-1000.000000000000000000",
      acceptedCollaterals: [],
      interestRate: 150.0, // Over 100%
      termOptions: [],
      minLoanAmount: "10000.000000000000000000",
      maxLoanAmount: "5000.000000000000000000", // Min > Max
      liquidationMode: "invalid"
    },
    response: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          principalBlockchainKey: "Invalid blockchain key format",
          principalTokenId: "Token ID cannot be empty",
          totalAmount: "Total amount must be positive",
          acceptedCollaterals: "At least one collateral currency must be specified",
          interestRate: "Interest rate must be between 0 and 100",
          termOptions: "At least one term option must be specified",
          minLoanAmount: "Minimum loan amount cannot be greater than maximum",
          liquidationMode: "Liquidation mode must be 'partial' or 'full'"
        }
      },
      timestamp: "2024-03-15T10:30:00.000Z",
      requestId: "req_loan_offer_validation"
    }
  },

  // Insufficient balance error
  insufficientBalanceError: {
    response: {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE", 
        message: "Insufficient USDC balance to fund loan offer"
      },
      timestamp: "2024-03-15T10:45:00.000Z",
      requestId: "req_insufficient_balance"
    }
  }
} as const;

// =============================================================================
// LOAN APPLICATION API MOCKS  
// =============================================================================

export const loanApplicationMocks = {
  // Calculate loan requirements
  calculateLoanRequirements: {
    request: {
      collateralBlockchainKey: "bip122:000000000019d6689c085ae165831e93",
      collateralTokenId: "slip44:0",
      principalAmount: "15000.000000000000000000",
      principalBlockchainKey: "eip155:56",
      principalTokenId: "erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"
    },
    response: {
      success: true,
      data: {
        requiredCollateral: "0.625000000000000000", // 15k / 40k BTC price * 1.67 buffer
        exchangeRate: "40000.000000000000000000",
        maxLtvRatio: 0.60,
        safetyBuffer: 0.20,
        collateralInvoice: {
          id: "inv_calc_clx9k4m5n0007wa6h6a3d9zb",
          amount: "0.625000000000000000", 
          currency: mockCurrencies.btc,
          walletAddress: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
          expiryDate: "2024-03-22T15:30:00.000Z",
          paidDate: null,
          expiredDate: null
        }
      }
    }
  },

  // Interest rate validation - valid
  validateInterestRateValid: {
    request: {
      proposedRate: "12.5000",
      loanTerms: {
        principalAmount: "15000.000000000000000000",
        collateralAmount: "0.625000000000000000",
        duration: 180, // 6 months in days
        collateralCurrencyBlockchainKey: "bip122:000000000019d6689c085ae165831e93",
        collateralCurrencyTokenId: "slip44:0",
        loanCurrencyBlockchainKey: "eip155:56", 
        loanCurrencyTokenId: "erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"
      },
      applicantProfile: {
        userType: "Individual",
        creditScore: null,
        previousLoanCount: 0
      }
    },
    response: {
      success: true,
      data: {
        isValid: true,
        validationDetails: {
          withinPlatformLimits: true,
          competitiveRating: "competitive",
          marketComparison: {
            averageMarketRate: "11.2500",
            percentileRank: 65,
            recommendedRange: {
              min: "9.5000",
              max: "14.0000"
            }
          },
          platformLimits: {
            minRate: "5.0000",
            maxRate: "25.0000"
          }
        },
        recommendations: [],
        warnings: []
      }
    }
  },

  // Interest rate validation - high rate
  validateInterestRateHigh: {
    request: {
      proposedRate: "22.0000",
      loanTerms: {
        principalAmount: "8000.000000000000000000",
        collateralAmount: "200.000000000000000000", 
        duration: 30, // 1 month
        collateralCurrencyBlockchainKey: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp",
        collateralCurrencyTokenId: "slip44:501",
        loanCurrencyBlockchainKey: "eip155:56",
        loanCurrencyTokenId: "erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d"
      },
      applicantProfile: {
        userType: "Individual", 
        creditScore: null,
        previousLoanCount: 0
      }
    },
    response: {
      success: true,
      data: {
        isValid: true,
        validationDetails: {
          withinPlatformLimits: true,
          competitiveRating: "above_market",
          marketComparison: {
            averageMarketRate: "15.7500",
            percentileRank: 85,
            recommendedRange: {
              min: "13.0000", 
              max: "18.0000"
            }
          },
          platformLimits: {
            minRate: "5.0000",
            maxRate: "25.0000"
          }
        },
        recommendations: [
          {
            type: "rate_adjustment",
            message: "Consider reducing rate to 16.5% for better competitiveness",
            suggestedRate: "16.5000"
          }
        ],
        warnings: [
          "Rate is above 80th percentile of recent successful loans",
          "High volatility collateral (SOL) with premium rate may limit matching opportunities"
        ]
      }
    }
  },

  // Create loan application
  createLoanApplication: {
    request: {
      collateralBlockchainKey: "bip122:000000000019d6689c085ae165831e93",
      collateralTokenId: "slip44:0",
      principalAmount: "15000.000000000000000000",
      principalBlockchainKey: "eip155:56",
      principalTokenId: "erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      maxInterestRate: 14.0,
      termMonths: 6,
      liquidationMode: "partial",
      minLtvRatio: 0.45
    },
    response: {
      success: true,
      data: mockLoanApplications.btcApplicationPublished
    }
  },

  // Get my loan applications
  getMyLoanApplications: {
    response: {
      success: true,
      data: {
        applications: [
          mockLoanApplications.btcApplicationPublished,
          mockLoanApplications.ethApplicationPending,
          mockLoanApplications.bnbApplicationMatched
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 3,
          totalPages: 1, 
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Update loan application - cancel
  cancelLoanApplication: {
    request: {
      action: "cancel"
    },
    response: {
      success: true,
      data: {
        ...mockLoanApplications.ethApplicationPending,
        status: "closed",
        closureReason: "Cancelled by borrower"
      }
    }
  },

  // Update loan application - extend
  extendLoanApplication: {
    request: {
      action: "extend",
      extendDays: 7
    },
    response: {
      success: true,
      data: {
        ...mockLoanApplications.btcApplicationPublished,
        expiryDate: "2024-03-26T11:20:00.000Z" // Extended by 7 days
      }
    }
  },

  // Validation errors
  createLoanApplicationValidationError: {
    request: {
      collateralBlockchainKey: "",
      collateralTokenId: "invalid_token",
      principalAmount: "0.000000000000000000",
      principalBlockchainKey: "eip155:56",
      principalTokenId: "erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d",
      maxInterestRate: -5.0,
      termMonths: 24, // Not in allowed options
      liquidationMode: "invalid",
      minLtvRatio: 1.5 // Over 100%
    },
    response: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          collateralBlockchainKey: "Collateral blockchain key cannot be empty",
          collateralTokenId: "Invalid collateral token ID", 
          principalAmount: "Principal amount must be greater than 0",
          maxInterestRate: "Interest rate cannot be negative",
          termMonths: "Term must be one of: 1, 3, 6, 12 months",
          liquidationMode: "Liquidation mode must be 'partial' or 'full'",
          minLtvRatio: "LTV ratio must be between 0 and 1"
        }
      },
      timestamp: "2024-03-15T11:15:00.000Z",
      requestId: "req_loan_app_validation"
    }
  }
} as const;

// =============================================================================
// ACTIVE LOAN API MOCKS
// =============================================================================

export const loanMocks = {
  // List loans
  listLoans: {
    response: {
      success: true,
      data: {
        loans: [
          mockLoans.btcLoanActive,
          mockLoans.ethLoanRepaid,
          mockLoans.solLoanLiquidated
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 3,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // List loans - borrower view
  listLoansBorrower: {
    response: {
      success: true,
      data: {
        loans: [
          mockLoans.btcLoanActive,
          mockLoans.ethLoanRepaid
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // List loans - lender view  
  listLoansLender: {
    response: {
      success: true,
      data: {
        loans: [
          mockLoans.btcLoanActive,
          mockLoans.solLoanLiquidated
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Get loan details
  getLoanDetails: {
    response: {
      success: true,
      data: mockLoans.btcLoanActive
    }
  },

  // Process loan repayment - full repayment
  processLoanRepaymentFull: {
    request: {
      amount: "16062.500000000000000000" // Principal + interest + origination fee
    },
    response: {
      success: true,
      data: {
        repaymentAmount: "16062.500000000000000000",
        remainingBalance: "0.000000000000000000",
        collateralReleased: "0.625000000000000000", // Full BTC collateral returned
        status: "repaid"
      }
    }
  },

  // Process loan repayment - partial payment
  processLoanRepaymentPartial: {
    request: {
      amount: "8000.000000000000000000" // Only principal
    },
    response: {
      success: true,
      data: {
        repaymentAmount: "8000.000000000000000000", 
        remainingBalance: "8062.500000000000000000", // Interest + origination fee remaining
        collateralReleased: "0.000000000000000000", // No collateral released for partial payment
        status: "active"
      }
    }
  },

  // Loan repayment - insufficient funds
  loanRepaymentInsufficientFunds: {
    request: {
      amount: "20000.000000000000000000" // More than available balance
    },
    response: {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: "Insufficient USDC balance for loan repayment"
      },
      timestamp: "2024-03-15T14:20:00.000Z",
      requestId: "req_repayment_insufficient"
    }
  },

  // Loan not found
  loanNotFoundError: {
    response: {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Loan not found"
      },
      timestamp: "2024-03-15T14:35:00.000Z",
      requestId: "req_loan_not_found"
    }
  }
} as const;

// =============================================================================
// LOAN VALUATION API MOCKS
// =============================================================================

export const loanValuationMocks = {
  // Get loan valuation history
  getLoanValuationHistory: {
    response: {
      success: true,
      data: {
        valuations: mockLoanValuations.slice(0, 2), // BTC loan valuations
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Get loan valuation history - liquidated loan
  getLoanValuationHistoryLiquidated: {
    response: {
      success: true,
      data: {
        valuations: mockLoanValuations.slice(2, 4), // SOL loan valuations leading to liquidation
        pagination: {
          page: 1,
          limit: 20,
          total: 2,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  }
} as const;

// =============================================================================
// ADMIN API MOCKS
// =============================================================================

export const loanAdminMocks = {
  // Trigger loan matching
  triggerLoanMatching: {
    response: {
      success: true,
      data: {
        message: "Loan matching algorithm triggered successfully",
        matchingResults: {
          applicationsProcessed: 5,
          offersProcessed: 8,
          successfulMatches: 2,
          newLoansCreated: [
            "lon_clxak5m6n0004wb7i7b4eaza",
            "lon_clxak5m6n0005wb7i7b4eazb"
          ]
        }
      }
    }
  }
} as const;

// =============================================================================
// ERROR RESPONSE TEMPLATES  
// =============================================================================

export const loanErrorTemplates = {
  validation: {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      details: {}
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_validation_error"
  },

  unauthorized: {
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required or token invalid"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_auth_error"
  },

  forbidden: {
    success: false,
    error: {
      code: "FORBIDDEN", 
      message: "Insufficient permissions to access this resource"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_forbidden_error"
  },

  notFound: {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Resource not found"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_not_found_error"
  },

  insufficientBalance: {
    success: false,
    error: {
      code: "INSUFFICIENT_BALANCE",
      message: "Insufficient balance for this operation"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_insufficient_balance"
  },

  ltvBreach: {
    success: false,
    error: {
      code: "LTV_BREACH",
      message: "Collateral value insufficient, LTV ratio exceeded maximum threshold"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_ltv_breach"
  },

  loanExpired: {
    success: false,
    error: {
      code: "LOAN_EXPIRED", 
      message: "Loan offer or application has expired"
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_loan_expired"
  },

  rateLimited: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later."
    },
    timestamp: "2024-03-15T12:00:00.000Z",
    requestId: "req_rate_limit_error",
    retryAfter: 300
  }
} as const;

// =============================================================================
// COMPLETE LOAN JOURNEY SCENARIOS  
// =============================================================================

export const loanScenarios = {
  // Complete lending journey: Offer creation to loan disbursement
  lenderJourney: {
    step1_createOffer: loanOfferMocks.createLoanOffer,
    step2_fundOffer: {
      // Invoice payment processing would happen here
      fundingInvoice: mockLoanOffers.btcOfferPublished.fundingInvoice
    },
    step3_offerPublished: {
      offer: {
        ...mockLoanOffers.btcOfferPublished,
        status: "published"
      }
    },
    step4_matchedWithApplication: {
      matchedLoan: mockLoans.btcLoanActive
    },
    step5_loanDisbursed: {
      disbursement: {
        loanId: mockLoans.btcLoanActive.id,
        principalAmount: mockLoans.btcLoanActive.principalAmount,
        disbursementDate: mockLoans.btcLoanActive.disbursementDate
      }
    }
  },

  // Complete borrowing journey: Application to loan repayment  
  borrowerJourney: {
    step1_calculateRequirements: loanApplicationMocks.calculateLoanRequirements,
    step2_validateInterestRate: loanApplicationMocks.validateInterestRateValid,
    step3_createApplication: loanApplicationMocks.createLoanApplication,
    step4_depositCollateral: {
      // Collateral deposit processing
      collateralInvoice: mockLoanApplications.btcApplicationPublished.collateralInvoice
    },
    step5_applicationPublished: {
      application: {
        ...mockLoanApplications.btcApplicationPublished,
        status: "published"
      }
    },
    step6_matchedWithOffer: {
      matchedLoan: mockLoans.btcLoanActive
    },
    step7_loanActive: {
      activeLoan: mockLoans.btcLoanActive
    },
    step8_loanRepayment: loanMocks.processLoanRepaymentFull
  },

  // Liquidation scenario
  liquidationJourney: {
    step1_activeLoan: mockLoans.solLoanLiquidated,
    step2_ltvMonitoring: loanValuationMocks.getLoanValuationHistoryLiquidated,
    step3_ltvBreach: {
      warning: {
        loanId: mockLoans.solLoanLiquidated.id,
        currentLtv: 0.75,
        maxLtv: 0.50,
        warningType: "liquidation_threshold_breached"
      }
    },
    step4_liquidationExecuted: {
      liquidation: {
        loanId: mockLoans.solLoanLiquidated.id,
        liquidationDate: mockLoans.solLoanLiquidated.liquidationDate,
        collateralLiquidated: "200.000000000000000000",
        proceedsDistributed: "8720.000000000000000000", // After fees
        surplus: "0.000000000000000000"
      }
    }
  },

  // Error handling scenarios
  errorScenarios: {
    validationError: loanOfferMocks.createLoanOfferValidationError,
    insufficientBalance: loanOfferMocks.insufficientBalanceError,
    loanNotFound: loanMocks.loanNotFoundError,
    ltvBreach: loanErrorTemplates.ltvBreach,
    loanExpired: loanErrorTemplates.loanExpired,
    unauthorized: loanErrorTemplates.unauthorized,
    rateLimited: loanErrorTemplates.rateLimited
  }
} as const;

// =============================================================================
// UTILITY FUNCTIONS FOR MOCK DATA GENERATION
// =============================================================================

export const loanMockHelpers = {
  // Generate realistic loan amounts based on currency
  generateLoanAmounts: {
    usdtAmounts: () => {
      const amounts = [500, 1000, 2000, 5000, 8000, 10000, 15000, 20000, 25000, 50000];
      return amounts[Math.floor(Math.random() * amounts.length)];
    },
    
    btcAmounts: (usdAmount: number, btcPrice = 40000) => {
      return (usdAmount / btcPrice * 1.67).toFixed(18); // With safety buffer
    },
    
    ethAmounts: (usdAmount: number, ethPrice = 2000) => {
      return (usdAmount / ethPrice * 1.43).toFixed(18); // With safety buffer
    },
    
    bnbAmounts: (usdAmount: number, bnbPrice = 400) => {
      return (usdAmount / bnbPrice * 2.0).toFixed(18); // With safety buffer 
    },
    
    solAmounts: (usdAmount: number, solPrice = 80) => {
      return (usdAmount / solPrice * 2.0).toFixed(9); // With safety buffer
    }
  },

  // Generate interest rates based on risk profile
  generateInterestRates: {
    conservative: () => Number((8 + Math.random() * 4).toFixed(4)), // 8-12%
    moderate: () => Number((12 + Math.random() * 6).toFixed(4)), // 12-18%
    aggressive: () => Number((18 + Math.random() * 7).toFixed(4)) // 18-25%
  },

  // Generate LTV ratios based on collateral type
  generateLtvRatios: {
    btc: {
      max: 0.60,
      warning: 0.48,
      critical: 0.57,
      liquidation: 0.60
    },
    eth: {
      max: 0.70,
      warning: 0.56,
      critical: 0.665,
      liquidation: 0.70
    },
    bnb: {
      max: 0.50,
      warning: 0.40,
      critical: 0.475,
      liquidation: 0.50
    },
    sol: {
      max: 0.50,
      warning: 0.40,
      critical: 0.475,
      liquidation: 0.50
    }
  },

  // Generate timestamps for loan lifecycle
  generateTimestamps: {
    recent: () => new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
    past: (daysAgo: number) => new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString(),
    future: (daysFromNow: number) => new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString(),
    
    loanTerm: (termMonths: number, startDate: string) => {
      const start = new Date(startDate);
      start.setMonth(start.getMonth() + termMonths);
      return start.toISOString();
    }
  },

  // Generate wallet addresses for different blockchains
  generateWalletAddresses: {
    bitcoin: () => `bc1q${Math.random().toString(36).substr(2, 37)}`,
    ethereum: () => `0x${Math.random().toString(16).substr(2, 40)}`,
    solana: () => Math.random().toString(36).substr(2, 44)
  },

  // Generate unique IDs following the pattern
  generateIds: {
    loanOfferId: () => `lof_clx${Math.random().toString(36).substr(2, 15)}`,
    loanApplicationId: () => `lap_clx${Math.random().toString(36).substr(2, 15)}`,
    loanId: () => `lon_clx${Math.random().toString(36).substr(2, 15)}`,
    invoiceId: () => `inv_clx${Math.random().toString(36).substr(2, 15)}`,
    valuationId: () => `val_clx${Math.random().toString(36).substr(2, 15)}`,
    requestId: () => `req_${Math.random().toString(36).substr(2, 12)}`
  },

  // Calculate loan fees based on SRS requirements
  calculateFees: {
    originationFee: (principal: number) => principal * 0.03, // 3% origination fee
    interestAmount: (principal: number, rate: number, termMonths: number) => 
      principal * (rate / 100) * (termMonths / 12),
    lenderFeeIndividual: (interest: number) => interest * 0.15, // 15% of interest
    lenderFeeInstitution: (interest: number) => interest * 0.05, // 5% of interest
    liquidationFee: (amount: number) => amount * 0.02, // 2% liquidation fee
    earlyLiquidationFee: (amount: number) => amount * 0.01 // 1% early liquidation fee
  }
} as const;

export default {
  mockCurrencies,
  mockLoanOffers,
  mockLoanApplications, 
  mockLoans,
  mockLoanValuations,
  loanOfferMocks,
  loanApplicationMocks,
  loanMocks,
  loanValuationMocks,
  loanAdminMocks,
  loanErrorTemplates,
  loanScenarios,
  loanMockHelpers
};