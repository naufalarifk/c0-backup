/**
 * Comprehensive Finance API Mock Data
 * Based on SRS-CG-v2.3-EN requirements, OpenAPI specifications, and PostgreSQL schemas
 */

// =============================================================================
// BASE CURRENCIES AND EXCHANGE RATES
// =============================================================================

export const mockCurrencies = {
  // Bitcoin on Bitcoin mainnet
  btc: {
    blockchainKey: "bip122:000000000019d6689c085ae165831e93",
    tokenId: "slip44:0",
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 8,
    logoUrl: "https://assets.cryptogadai.com/currencies/btc.png"
  },

  // Ethereum on Ethereum mainnet
  eth: {
    blockchainKey: "eip155:1",
    tokenId: "slip44:60",
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
    logoUrl: "https://assets.cryptogadai.com/currencies/eth.png"
  },

  // BNB on BSC
  bnb: {
    blockchainKey: "eip155:56",
    tokenId: "slip44:60",
    name: "BNB",
    symbol: "BNB",
    decimals: 18,
    logoUrl: "https://assets.cryptogadai.com/currencies/bnb.png"
  },

  // Solana on Solana mainnet
  sol: {
    blockchainKey: "solana:5eykt4UsFv8P8NjdTREpY1vzqKqZKvdp",
    tokenId: "slip44:501",
    name: "Solana",
    symbol: "SOL",
    decimals: 9,
    logoUrl: "https://assets.cryptogadai.com/currencies/sol.png"
  },

  // USDT on Ethereum
  usdtEth: {
    blockchainKey: "eip155:1",
    tokenId: "erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7",
    name: "Tether USD (Ethereum)",
    symbol: "USDT",
    decimals: 6,
    logoUrl: "https://assets.cryptogadai.com/currencies/usdt.png"
  },

  // USDT on BSC
  usdtBsc: {
    blockchainKey: "eip155:56",
    tokenId: "bep20:0x55d398326f99059fF775485246999027B3197955",
    name: "Tether USD (BSC)",
    symbol: "USDT",
    decimals: 18,
    logoUrl: "https://assets.cryptogadai.com/currencies/usdt.png"
  },

  // USDT on Solana
  usdtSol: {
    blockchainKey: "solana:5eykt4UsFv8P8NjdTREpY1vzqKqZKvdp",
    tokenId: "spl:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    name: "Tether USD (Solana)",
    symbol: "USDT",
    decimals: 6,
    logoUrl: "https://assets.cryptogadai.com/currencies/usdt.png"
  }
} as const;

export const mockExchangeRates = {
  // Current market rates
  currentRates: {
    response: {
      success: true,
      data: {
        exchangeRates: [
          {
            id: 1,
            baseAsset: mockCurrencies.btc,
            quoteAsset: mockCurrencies.usdtEth,
            bidPrice: "67850.000000000000000000",
            askPrice: "67890.000000000000000000",
            midPrice: "67870.000000000000000000",
            source: "binance",
            sourceDate: "2024-03-15T15:29:45.000Z",
            retrievalDate: "2024-03-15T15:30:00.000Z"
          },
          {
            id: 2,
            baseAsset: mockCurrencies.eth,
            quoteAsset: mockCurrencies.usdtEth,
            bidPrice: "3450.750000000000000000",
            askPrice: "3451.250000000000000000",
            midPrice: "3451.000000000000000000",
            source: "coinbase",
            sourceDate: "2024-03-15T15:29:50.000Z",
            retrievalDate: "2024-03-15T15:30:00.000Z"
          },
          {
            id: 3,
            baseAsset: mockCurrencies.bnb,
            quoteAsset: mockCurrencies.usdtBsc,
            bidPrice: "420.500000000000000000",
            askPrice: "421.000000000000000000",
            midPrice: "420.750000000000000000",
            source: "binance",
            sourceDate: "2024-03-15T15:29:55.000Z",
            retrievalDate: "2024-03-15T15:30:00.000Z"
          },
          {
            id: 4,
            baseAsset: mockCurrencies.sol,
            quoteAsset: mockCurrencies.usdtSol,
            bidPrice: "165.250000000000000000",
            askPrice: "165.750000000000000000",
            midPrice: "165.500000000000000000",
            source: "coinbase",
            sourceDate: "2024-03-15T15:29:40.000Z",
            retrievalDate: "2024-03-15T15:30:00.000Z"
          }
        ],
        lastUpdated: "2024-03-15T15:30:00.000Z"
      }
    }
  },

  // Filtered rates - BTC only
  btcRates: {
    response: {
      success: true,
      data: {
        exchangeRates: [
          {
            id: 1,
            baseAsset: mockCurrencies.btc,
            quoteAsset: mockCurrencies.usdtEth,
            bidPrice: "67850.000000000000000000",
            askPrice: "67890.000000000000000000",
            midPrice: "67870.000000000000000000",
            source: "binance",
            sourceDate: "2024-03-15T15:29:45.000Z",
            retrievalDate: "2024-03-15T15:30:00.000Z"
          }
        ],
        lastUpdated: "2024-03-15T15:30:00.000Z"
      }
    }
  }
} as const;

// =============================================================================
// ACCOUNT BALANCES AND MUTATIONS
// =============================================================================

export const mockAccountBalances = {
  // Individual user with mixed balances
  individualBalances: {
    response: {
      success: true,
      data: {
        accounts: [
          {
            id: 101,
            currency: mockCurrencies.btc,
            balance: "0.125000000000000000",
            lastUpdated: "2024-03-15T10:30:00.000Z"
          },
          {
            id: 102,
            currency: mockCurrencies.eth,
            balance: "5.750000000000000000",
            lastUpdated: "2024-03-15T10:30:00.000Z"
          },
          {
            id: 103,
            currency: mockCurrencies.usdtEth,
            balance: "12500.750000000000000000",
            lastUpdated: "2024-03-15T14:20:00.000Z"
          },
          {
            id: 104,
            currency: mockCurrencies.usdtBsc,
            balance: "0.000000000000000000",
            lastUpdated: "2024-03-10T09:15:00.000Z"
          }
        ],
        totalPortfolioValue: {
          amount: "45876.325000",
          currency: "USD",
          lastUpdated: "2024-03-15T15:30:00.000Z"
        }
      }
    }
  },

  // Institution with large balances
  institutionBalances: {
    response: {
      success: true,
      data: {
        accounts: [
          {
            id: 201,
            currency: mockCurrencies.usdtEth,
            balance: "500000.000000000000000000",
            lastUpdated: "2024-03-15T08:00:00.000Z"
          },
          {
            id: 202,
            currency: mockCurrencies.usdtBsc,
            balance: "250000.000000000000000000",
            lastUpdated: "2024-03-15T08:00:00.000Z"
          },
          {
            id: 203,
            currency: mockCurrencies.btc,
            balance: "0.000000000000000000",
            lastUpdated: "2024-03-01T00:00:00.000Z"
          }
        ],
        totalPortfolioValue: {
          amount: "750000.000000",
          currency: "USD",
          lastUpdated: "2024-03-15T15:30:00.000Z"
        }
      }
    }
  },

  // Empty balances for new user
  emptyBalances: {
    response: {
      success: true,
      data: {
        accounts: [
          {
            id: 301,
            currency: mockCurrencies.btc,
            balance: "0.000000000000000000",
            lastUpdated: "2024-03-15T16:00:00.000Z"
          },
          {
            id: 302,
            currency: mockCurrencies.eth,
            balance: "0.000000000000000000",
            lastUpdated: "2024-03-15T16:00:00.000Z"
          },
          {
            id: 303,
            currency: mockCurrencies.usdtEth,
            balance: "0.000000000000000000",
            lastUpdated: "2024-03-15T16:00:00.000Z"
          }
        ],
        totalPortfolioValue: {
          amount: "0.000000",
          currency: "USD",
          lastUpdated: "2024-03-15T16:00:00.000Z"
        }
      }
    }
  }
} as const;

export const mockAccountMutations = {
  // Loan lifecycle mutations for borrower
  borrowerMutations: {
    response: {
      success: true,
      data: {
        mutations: [
          // Initial collateral deposit
          {
            id: 1001,
            mutationType: "LoanCollateralDeposit",
            mutationDate: "2024-03-10T10:00:00.000Z",
            amount: "-2.500000000000000000",
            description: "ETH collateral deposit for loan application #789",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "3.250000000000000000"
          },
          // Collateral escrowed when application published
          {
            id: 1002,
            mutationType: "LoanApplicationCollateralEscrowed",
            mutationDate: "2024-03-10T10:05:00.000Z",
            amount: "0.000000000000000000",
            description: "ETH collateral escrowed for published loan application #789",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "3.250000000000000000"
          },
          // Principal disbursement received
          {
            id: 1003,
            mutationType: "LoanPrincipalDisbursement",
            mutationDate: "2024-03-11T14:30:00.000Z",
            amount: "10000.000000000000000000",
            description: "USDT loan principal disbursement for loan #789",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "10000.000000000000000000"
          },
          // Loan repayment (principal + interest + fees)
          {
            id: 1004,
            mutationType: "LoanRepayment",
            mutationDate: "2024-06-11T09:15:00.000Z",
            amount: "-10900.000000000000000000",
            description: "Loan #789 repayment: principal 10000 + interest 600 + origination fee 300",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "-900.000000000000000000"
          },
          // Collateral returned
          {
            id: 1005,
            mutationType: "LoanCollateralReturned",
            mutationDate: "2024-06-11T09:20:00.000Z",
            amount: "2.500000000000000000",
            description: "ETH collateral returned after loan #789 repayment",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "5.750000000000000000"
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 5,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Lender mutations for loan lifecycle
  lenderMutations: {
    response: {
      success: true,
      data: {
        mutations: [
          // Principal funded for offer
          {
            id: 2001,
            mutationType: "LoanPrincipalFunded",
            mutationDate: "2024-03-10T08:00:00.000Z",
            amount: "-10000.000000000000000000",
            description: "USDT funded for loan offer #456",
            referenceId: 456,
            referenceType: "loan_offer",
            balanceAfter: "490000.000000000000000000"
          },
          // Principal escrowed when offer published
          {
            id: 2002,
            mutationType: "LoanOfferPrincipalEscrowed",
            mutationDate: "2024-03-10T08:05:00.000Z",
            amount: "0.000000000000000000",
            description: "USDT principal escrowed for published loan offer #456",
            referenceId: 456,
            referenceType: "loan_offer",
            balanceAfter: "490000.000000000000000000"
          },
          // Principal returned and interest received
          {
            id: 2003,
            mutationType: "LoanPrincipalReturned",
            mutationDate: "2024-06-11T09:25:00.000Z",
            amount: "10000.000000000000000000",
            description: "USDT principal returned from loan #789",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "500000.000000000000000000"
          },
          // Interest received (after platform fee deduction)
          {
            id: 2004,
            mutationType: "LoanInterestReceived",
            mutationDate: "2024-06-11T09:25:00.000Z",
            amount: "570.000000000000000000",
            description: "Interest received from loan #789: 600 - 30 platform fee (5%)",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "500570.000000000000000000"
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 4,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Invoice payment mutations
  invoicePaymentMutations: {
    response: {
      success: true,
      data: {
        mutations: [
          // Deposit via invoice
          {
            id: 3001,
            mutationType: "InvoiceReceived",
            mutationDate: "2024-03-14T16:30:00.000Z",
            amount: "5000.000000000000000000",
            description: "USDT deposit via invoice #INV-20240314-001",
            referenceId: 12345,
            referenceType: "invoice",
            balanceAfter: "17500.750000000000000000"
          },
          // Partial payment accumulated
          {
            id: 3002,
            mutationType: "InvoiceReceived",
            mutationDate: "2024-03-13T11:15:00.000Z",
            amount: "500.000000000000000000",
            description: "Partial USDT payment for invoice #INV-20240313-002 (500/1000 paid)",
            referenceId: 12346,
            referenceType: "invoice",
            balanceAfter: "12500.750000000000000000"
          },
          // Overpayment credited
          {
            id: 3003,
            mutationType: "InvoiceReceived",
            mutationDate: "2024-03-12T14:45:00.000Z",
            amount: "1050.000000000000000000",
            description: "USDT payment for invoice #INV-20240312-003: 1000 + 50 overpayment credited",
            referenceId: 12347,
            referenceType: "invoice",
            balanceAfter: "12000.750000000000000000"
          }
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

  // Withdrawal mutations
  withdrawalMutations: {
    response: {
      success: true,
      data: {
        mutations: [
          // Withdrawal requested (balance debited)
          {
            id: 4001,
            mutationType: "WithdrawalRequested",
            mutationDate: "2024-03-15T12:00:00.000Z",
            amount: "-5000.000000000000000000",
            description: "USDT withdrawal request #WD-20240315-001 to 0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567",
            referenceId: 5001,
            referenceType: "withdrawal",
            balanceAfter: "7500.750000000000000000"
          },
          // Failed withdrawal refunded
          {
            id: 4002,
            mutationType: "WithdrawalRefunded",
            mutationDate: "2024-03-14T18:30:00.000Z",
            amount: "1000.000000000000000000",
            description: "USDT refund for failed withdrawal #WD-20240314-002: insufficient gas",
            referenceId: 5002,
            referenceType: "withdrawal",
            balanceAfter: "12500.750000000000000000"
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

  // Platform fee mutations
  platformFeeMutations: {
    response: {
      success: true,
      data: {
        mutations: [
          // Origination fee charged
          {
            id: 5001,
            mutationType: "PlatformFeeCharged",
            mutationDate: "2024-06-11T09:15:00.000Z",
            amount: "-300.000000000000000000",
            description: "Origination fee (3%) for loan #789",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "7200.750000000000000000"
          },
          // Liquidation fee charged
          {
            id: 5002,
            mutationType: "PlatformFeeCharged",
            mutationDate: "2024-03-01T15:45:00.000Z",
            amount: "-200.000000000000000000",
            description: "Liquidation fee (2%) for forced liquidation of loan #678",
            referenceId: 678,
            referenceType: "loan",
            balanceAfter: "7500.750000000000000000"
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

  // Filtered mutations - loan operations only
  loanMutationsFiltered: {
    request: {
      mutationType: "LoanPrincipalDisbursement"
    },
    response: {
      success: true,
      data: {
        mutations: [
          {
            id: 1003,
            mutationType: "LoanPrincipalDisbursement",
            mutationDate: "2024-03-11T14:30:00.000Z",
            amount: "10000.000000000000000000",
            description: "USDT loan principal disbursement for loan #789",
            referenceId: 789,
            referenceType: "loan",
            balanceAfter: "10000.000000000000000000"
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Date range filtered mutations
  recentMutations: {
    request: {
      fromDate: "2024-03-10T00:00:00.000Z",
      toDate: "2024-03-15T23:59:59.000Z"
    },
    response: {
      success: true,
      data: {
        mutations: [
          {
            id: 4001,
            mutationType: "WithdrawalRequested",
            mutationDate: "2024-03-15T12:00:00.000Z",
            amount: "-5000.000000000000000000",
            description: "USDT withdrawal request #WD-20240315-001",
            referenceId: 5001,
            referenceType: "withdrawal",
            balanceAfter: "7500.750000000000000000"
          },
          {
            id: 3001,
            mutationType: "InvoiceReceived",
            mutationDate: "2024-03-14T16:30:00.000Z",
            amount: "5000.000000000000000000",
            description: "USDT deposit via invoice #INV-20240314-001",
            referenceId: 12345,
            referenceType: "invoice",
            balanceAfter: "17500.750000000000000000"
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
  }
} as const;

// =============================================================================
// WITHDRAWAL MANAGEMENT
// =============================================================================

export const mockBeneficiaries = {
  // List all beneficiaries
  allBeneficiaries: {
    response: {
      success: true,
      data: {
        beneficiaries: [
          {
            id: 1,
            currency: mockCurrencies.usdtEth,
            address: "0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567",
            label: "My Hardware Wallet",
            createdDate: "2024-02-15T10:00:00.000Z",
            verifiedDate: "2024-02-15T10:30:00.000Z",
            isActive: true
          },
          {
            id: 2,
            currency: mockCurrencies.usdtBsc,
            address: "0x8f2a9e9C7d4B3e2F1a7C6b5D8E9f3A2B4c7D9e1F",
            label: "BSC Trading Wallet",
            createdDate: "2024-03-01T14:20:00.000Z",
            verifiedDate: "2024-03-01T15:00:00.000Z",
            isActive: true
          },
          {
            id: 3,
            currency: mockCurrencies.btc,
            address: "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
            label: "Bitcoin Cold Storage",
            createdDate: "2024-03-10T09:15:00.000Z",
            verifiedDate: null,
            isActive: false
          }
        ]
      }
    }
  },

  // Filtered beneficiaries - Ethereum only
  ethereumBeneficiaries: {
    request: {
      blockchainKey: "eip155:1"
    },
    response: {
      success: true,
      data: {
        beneficiaries: [
          {
            id: 1,
            currency: mockCurrencies.usdtEth,
            address: "0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567",
            label: "My Hardware Wallet",
            createdDate: "2024-02-15T10:00:00.000Z",
            verifiedDate: "2024-02-15T10:30:00.000Z",
            isActive: true
          }
        ]
      }
    }
  },

  // Create new beneficiary
  createBeneficiary: {
    request: {
      blockchainKey: "eip155:56",
      tokenId: "bep20:0x55d398326f99059fF775485246999027B3197955",
      address: "0x1234567890abcdef1234567890abcdef12345678",
      label: "Exchange Withdrawal Wallet"
    },
    response: {
      success: true,
      data: {
        id: 4,
        currency: mockCurrencies.usdtBsc,
        address: "0x1234567890abcdef1234567890abcdef12345678",
        label: "Exchange Withdrawal Wallet",
        createdDate: "2024-03-15T16:30:00.000Z",
        verifiedDate: null,
        isActive: false
      }
    }
  },

  // Create beneficiary errors
  invalidAddressError: {
    request: {
      blockchainKey: "eip155:1",
      tokenId: "erc20:0xdAC17F958D2ee523a2206206994597C13D831ec7",
      address: "invalid_address",
      label: "Invalid Wallet"
    },
    response: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        validation_errors: [
          {
            field: "address",
            message: "Invalid Ethereum address format",
            code: "INVALID_FORMAT"
          }
        ]
      },
      timestamp: "2024-03-15T16:45:00.000Z"
    }
  },

  blacklistedAddressError: {
    response: {
      success: false,
      error: {
        code: "BLACKLISTED_ADDRESS",
        message: "Address is blacklisted and cannot be used for withdrawals"
      },
      timestamp: "2024-03-15T16:50:00.000Z"
    }
  }
} as const;

export const mockWithdrawals = {
  // List all withdrawals
  allWithdrawals: {
    response: {
      success: true,
      data: {
        withdrawals: [
          {
            id: 101,
            beneficiary: {
              id: 1,
              currency: mockCurrencies.usdtEth,
              address: "0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567",
              label: "My Hardware Wallet",
              createdDate: "2024-02-15T10:00:00.000Z",
              verifiedDate: "2024-02-15T10:30:00.000Z",
              isActive: true
            },
            requestAmount: "5000.000000000000000000",
            sentAmount: "4995.000000000000000000",
            networkFee: "5.000000000000000000",
            platformFee: "0.000000000000000000",
            requestDate: "2024-03-15T12:00:00.000Z",
            sentDate: "2024-03-15T12:15:00.000Z",
            sentHash: "0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab890cd123ef45",
            confirmedDate: "2024-03-15T12:45:00.000Z",
            failedDate: null,
            failureReason: null,
            state: "confirmed",
            blockchainExplorerUrl: "https://etherscan.io/tx/0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab890cd123ef45",
            estimatedConfirmationTime: null
          },
          {
            id: 102,
            beneficiary: {
              id: 2,
              currency: mockCurrencies.usdtBsc,
              address: "0x8f2a9e9C7d4B3e2F1a7C6b5D8E9f3A2B4c7D9e1F",
              label: "BSC Trading Wallet",
              createdDate: "2024-03-01T14:20:00.000Z",
              verifiedDate: "2024-03-01T15:00:00.000Z",
              isActive: true
            },
            requestAmount: "10000.000000000000000000",
            sentAmount: "9998.000000000000000000",
            networkFee: "2.000000000000000000",
            platformFee: "0.000000000000000000",
            requestDate: "2024-03-14T09:30:00.000Z",
            sentDate: "2024-03-14T09:45:00.000Z",
            sentHash: "0x789abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab890cd123ef",
            confirmedDate: "2024-03-14T10:15:00.000Z",
            failedDate: null,
            failureReason: null,
            state: "confirmed",
            blockchainExplorerUrl: "https://bscscan.com/tx/0x789abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab890cd123ef",
            estimatedConfirmationTime: null
          },
          {
            id: 103,
            beneficiary: {
              id: 1,
              currency: mockCurrencies.usdtEth,
              address: "0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567",
              label: "My Hardware Wallet",
              createdDate: "2024-02-15T10:00:00.000Z",
              verifiedDate: "2024-02-15T10:30:00.000Z",
              isActive: true
            },
            requestAmount: "2000.000000000000000000",
            sentAmount: null,
            networkFee: null,
            platformFee: null,
            requestDate: "2024-03-13T16:20:00.000Z",
            sentDate: "2024-03-13T16:35:00.000Z",
            sentHash: "0x456def789abc123ghi456jkl789mno012pqr345stu678vwx901yz234ab567cd890ef",
            confirmedDate: null,
            failedDate: "2024-03-13T17:00:00.000Z",
            failureReason: "Transaction failed: insufficient gas",
            state: "failed",
            blockchainExplorerUrl: "https://etherscan.io/tx/0x456def789abc123ghi456jkl789mno012pqr345stu678vwx901yz234ab567cd890ef",
            estimatedConfirmationTime: null
          },
          {
            id: 104,
            beneficiary: {
              id: 2,
              currency: mockCurrencies.usdtBsc,
              address: "0x8f2a9e9C7d4B3e2F1a7C6b5D8E9f3A2B4c7D9e1F",
              label: "BSC Trading Wallet",
              createdDate: "2024-03-01T14:20:00.000Z",
              verifiedDate: "2024-03-01T15:00:00.000Z",
              isActive: true
            },
            requestAmount: "500.000000000000000000",
            sentAmount: null,
            networkFee: null,
            platformFee: null,
            requestDate: "2024-03-15T18:00:00.000Z",
            sentDate: null,
            sentHash: null,
            confirmedDate: null,
            failedDate: null,
            failureReason: null,
            state: "requested",
            blockchainExplorerUrl: null,
            estimatedConfirmationTime: "5-10 minutes"
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 4,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Filtered withdrawals - confirmed only
  confirmedWithdrawals: {
    request: {
      state: "confirmed"
    },
    response: {
      success: true,
      data: {
        withdrawals: [
          {
            id: 101,
            beneficiary: {
              id: 1,
              currency: mockCurrencies.usdtEth,
              address: "0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567",
              label: "My Hardware Wallet",
              createdDate: "2024-02-15T10:00:00.000Z",
              verifiedDate: "2024-02-15T10:30:00.000Z",
              isActive: true
            },
            requestAmount: "5000.000000000000000000",
            sentAmount: "4995.000000000000000000",
            networkFee: "5.000000000000000000",
            platformFee: "0.000000000000000000",
            requestDate: "2024-03-15T12:00:00.000Z",
            sentDate: "2024-03-15T12:15:00.000Z",
            sentHash: "0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab890cd123ef45",
            confirmedDate: "2024-03-15T12:45:00.000Z",
            failedDate: null,
            failureReason: null,
            state: "confirmed",
            blockchainExplorerUrl: "https://etherscan.io/tx/0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab890cd123ef45",
            estimatedConfirmationTime: null
          }
        ],
        pagination: {
          page: 1,
          limit: 20,
          total: 1,
          totalPages: 1,
          hasNext: false,
          hasPrev: false
        }
      }
    }
  },

  // Get specific withdrawal
  getWithdrawal: {
    response: {
      success: true,
      data: {
        id: 101,
        beneficiary: {
          id: 1,
          currency: mockCurrencies.usdtEth,
          address: "0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567",
          label: "My Hardware Wallet",
          createdDate: "2024-02-15T10:00:00.000Z",
          verifiedDate: "2024-02-15T10:30:00.000Z",
          isActive: true
        },
        requestAmount: "5000.000000000000000000",
        sentAmount: "4995.000000000000000000",
        networkFee: "5.000000000000000000",
        platformFee: "0.000000000000000000",
        requestDate: "2024-03-15T12:00:00.000Z",
        sentDate: "2024-03-15T12:15:00.000Z",
        sentHash: "0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab890cd123ef45",
        confirmedDate: "2024-03-15T12:45:00.000Z",
        failedDate: null,
        failureReason: null,
        state: "confirmed",
        blockchainExplorerUrl: "https://etherscan.io/tx/0xabc123def456ghi789jkl012mno345pqr678stu901vwx234yz567ab890cd123ef45",
        estimatedConfirmationTime: null
      }
    }
  },

  // Request new withdrawal
  requestWithdrawal: {
    request: {
      beneficiaryId: 1,
      amount: "3000.000000000000000000",
      twoFactorCode: "123456"
    },
    response: {
      success: true,
      data: {
        id: 105,
        beneficiary: {
          id: 1,
          currency: mockCurrencies.usdtEth,
          address: "0x742d35Cc6634C0532925a3b8D5c9B0E1e1234567",
          label: "My Hardware Wallet",
          createdDate: "2024-02-15T10:00:00.000Z",
          verifiedDate: "2024-02-15T10:30:00.000Z",
          isActive: true
        },
        requestAmount: "3000.000000000000000000",
        sentAmount: null,
        networkFee: null,
        platformFee: null,
        requestDate: "2024-03-15T19:00:00.000Z",
        sentDate: null,
        sentHash: null,
        confirmedDate: null,
        failedDate: null,
        failureReason: null,
        state: "requested",
        blockchainExplorerUrl: null,
        estimatedConfirmationTime: "15-30 minutes"
      }
    }
  },

  // Request withdrawal refund
  requestRefund: {
    request: {
      reason: "Transaction failed due to insufficient gas, need refund to retry"
    },
    response: {
      success: true,
      message: "Refund request submitted successfully. Admin will review within 24 hours.",
      timestamp: "2024-03-15T19:15:00.000Z"
    }
  },

  // Withdrawal errors
  insufficientBalanceError: {
    request: {
      beneficiaryId: 1,
      amount: "50000.000000000000000000",
      twoFactorCode: "123456"
    },
    response: {
      success: false,
      error: {
        code: "INSUFFICIENT_BALANCE",
        message: "Insufficient account balance for withdrawal",
        details: {
          requestedAmount: "50000.000000000000000000",
          availableBalance: "12500.750000000000000000",
          deficit: "37499.250000000000000000"
        }
      },
      timestamp: "2024-03-15T19:20:00.000Z"
    }
  },

  invalid2FAError: {
    request: {
      beneficiaryId: 1,
      amount: "1000.000000000000000000",
      twoFactorCode: "invalid"
    },
    response: {
      success: false,
      error: {
        code: "INVALID_2FA_CODE",
        message: "Invalid two-factor authentication code"
      },
      timestamp: "2024-03-15T19:25:00.000Z"
    }
  },

  belowMinimumError: {
    request: {
      beneficiaryId: 1,
      amount: "50.000000000000000000",
      twoFactorCode: "123456"
    },
    response: {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        validation_errors: [
          {
            field: "amount",
            message: "Withdrawal amount must be at least 100 USDT",
            code: "MIN_VALUE"
          }
        ]
      },
      timestamp: "2024-03-15T19:30:00.000Z"
    }
  },

  dailyLimitExceededError: {
    response: {
      success: false,
      error: {
        code: "DAILY_LIMIT_EXCEEDED",
        message: "Daily withdrawal limit exceeded",
        details: {
          dailyLimit: "100000.000000000000000000",
          todayWithdrawn: "95000.000000000000000000",
          requestedAmount: "10000.000000000000000000",
          availableToday: "5000.000000000000000000"
        }
      },
      timestamp: "2024-03-15T19:35:00.000Z"
    }
  },

  inactiveBeneficiaryError: {
    response: {
      success: false,
      error: {
        code: "INACTIVE_BENEFICIARY",
        message: "Beneficiary address is not verified or has been deactivated"
      },
      timestamp: "2024-03-15T19:40:00.000Z"
    }
  }
} as const;

// =============================================================================
// ERROR RESPONSE TEMPLATES
// =============================================================================

export const financeErrorTemplates = {
  validation: {
    success: false,
    error: {
      code: "VALIDATION_ERROR",
      message: "Request validation failed",
      validation_errors: []
    },
    timestamp: "2024-03-15T12:00:00.000Z"
  },

  unauthorized: {
    success: false,
    error: {
      code: "UNAUTHORIZED",
      message: "Authentication required or token invalid"
    },
    timestamp: "2024-03-15T12:00:00.000Z"
  },

  forbidden: {
    success: false,
    error: {
      code: "FORBIDDEN",
      message: "Insufficient permissions to access this resource"
    },
    timestamp: "2024-03-15T12:00:00.000Z"
  },

  notFound: {
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "Resource not found"
    },
    timestamp: "2024-03-15T12:00:00.000Z"
  },

  rateLimited: {
    success: false,
    error: {
      code: "RATE_LIMIT_EXCEEDED",
      message: "Too many requests. Please try again later."
    },
    timestamp: "2024-03-15T12:00:00.000Z"
  },

  serverError: {
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "An unexpected error occurred. Please try again later."
    },
    timestamp: "2024-03-15T12:00:00.000Z"
  }
} as const;

// =============================================================================
// COMPLETE API MOCK SCENARIOS
// =============================================================================

export const financeApiScenarios = {
  // User journey: Deposit ’ Loan ’ Repayment ’ Withdrawal
  borrowerJourney: {
    step1_checkBalances: mockAccountBalances.emptyBalances,
    step2_depositCollateral: mockAccountMutations.borrowerMutations,
    step3_receiveLoan: mockAccountMutations.borrowerMutations,
    step4_repayLoan: mockAccountMutations.borrowerMutations,
    step5_getCollateralBack: mockAccountMutations.borrowerMutations,
    step6_createBeneficiary: mockBeneficiaries.createBeneficiary,
    step7_requestWithdrawal: mockWithdrawals.requestWithdrawal
  },

  // Lender journey: Fund offer ’ Receive repayment
  lenderJourney: {
    step1_checkBalances: mockAccountBalances.institutionBalances,
    step2_fundOffer: mockAccountMutations.lenderMutations,
    step3_receiveRepayment: mockAccountMutations.lenderMutations,
    step4_withdrawProfits: mockWithdrawals.requestWithdrawal
  },

  // Withdrawal flow: Create beneficiary ’ Request ’ Track status
  withdrawalFlow: {
    step1_listBeneficiaries: mockBeneficiaries.allBeneficiaries,
    step2_createBeneficiary: mockBeneficiaries.createBeneficiary,
    step3_requestWithdrawal: mockWithdrawals.requestWithdrawal,
    step4_trackWithdrawal: mockWithdrawals.getWithdrawal,
    step5_requestRefund: mockWithdrawals.requestRefund
  },

  // Error scenarios
  errorScenarios: {
    insufficientBalance: mockWithdrawals.insufficientBalanceError,
    invalid2FA: mockWithdrawals.invalid2FAError,
    invalidAddress: mockBeneficiaries.invalidAddressError,
    blacklistedAddress: mockBeneficiaries.blacklistedAddressError,
    dailyLimitExceeded: mockWithdrawals.dailyLimitExceededError,
    belowMinimum: mockWithdrawals.belowMinimumError,
    unauthorized: financeErrorTemplates.unauthorized,
    rateLimited: financeErrorTemplates.rateLimited
  }
} as const;

// =============================================================================
// UTILITY FUNCTIONS FOR MOCK DATA
// =============================================================================

export const financeHelpers = {
  // Generate realistic amounts
  generateAmounts: {
    btc: () => (Math.random() * 2 + 0.01).toFixed(18),
    eth: () => (Math.random() * 10 + 0.1).toFixed(18),
    usdt: () => (Math.random() * 50000 + 100).toFixed(18),
    smallUsdt: () => (Math.random() * 1000 + 100).toFixed(18),
    largeUsdt: () => (Math.random() * 100000 + 10000).toFixed(18)
  },

  // Generate blockchain addresses
  generateAddresses: {
    ethereum: () => "0x" + Array.from({length: 40}, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    bitcoin: () => "bc1q" + Array.from({length: 39}, () => "abcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(Math.random() * 36)]).join(""),
    solana: () => Array.from({length: 44}, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]).join("")
  },

  // Generate transaction hashes
  generateHashes: {
    ethereum: () => "0x" + Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    bitcoin: () => Array.from({length: 64}, () => Math.floor(Math.random() * 16).toString(16)).join(""),
    solana: () => Array.from({length: 88}, () => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789"[Math.floor(Math.random() * 58)]).join("")
  },

  // Generate timestamps
  generateTimestamps: {
    recent: () => new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString(),
    past: () => new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString(),
    future: () => new Date(Date.now() + Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000)).toISOString()
  },

  // Generate IDs
  generateIds: {
    account: () => Math.floor(Math.random() * 9000) + 1000,
    mutation: () => Math.floor(Math.random() * 90000) + 10000,
    beneficiary: () => Math.floor(Math.random() * 900) + 100,
    withdrawal: () => Math.floor(Math.random() * 9000) + 1000,
    invoice: () => Math.floor(Math.random() * 90000) + 10000,
    loan: () => Math.floor(Math.random() * 9000) + 100
  },

  // Calculate portfolio values
  calculatePortfolioValue: (accounts: any[]) => {
    // Mock exchange rates for calculation
    const rates = {
      BTC: 67870,
      ETH: 3451,
      BNB: 420.75,
      SOL: 165.5,
      USDT: 1
    };
    
    let totalValue = 0;
    accounts.forEach(account => {
      const symbol = account.currency.symbol;
      const balance = parseFloat(account.balance);
      totalValue += balance * (rates[symbol as keyof typeof rates] || 1);
    });
    
    return totalValue.toFixed(6);
  }
} as const;

export default {
  mockCurrencies,
  mockExchangeRates,
  mockAccountBalances,
  mockAccountMutations,
  mockBeneficiaries,
  mockWithdrawals,
  financeErrorTemplates,
  financeApiScenarios,
  financeHelpers
};