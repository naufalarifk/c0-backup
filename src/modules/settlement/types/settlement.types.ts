/**
 * Settlement module types
 */

export interface SettlementResult {
  success: boolean;
  blockchainKey: string;
  originalBalance: string;
  settlementAmount: string;
  remainingBalance: string;
  transactionHash?: string;
  error?: string;
  timestamp: Date;
  // Verification results
  verified?: boolean;
  verificationError?: string;
  verificationTimestamp?: Date;
  verificationDetails?: {
    blockchainConfirmed: boolean;
    binanceMatched: boolean;
    amountMatches: boolean;
    txHashMatches?: boolean;
    senderAddressMatches?: boolean;
    recipientAddressMatches?: boolean;
    binanceStatus?: 'pending' | 'credited' | 'success';
    errors?: string[];
  };
}

export interface BlockchainBalance {
  blockchainKey: string;
  balance: string;
  currency: string;
}

export interface ReconciliationReport {
  date: string;
  totalDeposits: number;
  verifiedDeposits: number;
  failedDeposits: number;
  totalWithdrawals: number;
  verifiedWithdrawals: number;
  failedWithdrawals: number;
  discrepancies: SettlementDiscrepancy[];
  timestamp: Date;
}

export interface SettlementDiscrepancy {
  transactionHash: string;
  blockchainKey: string;
  type: 'deposit' | 'withdrawal';
  issue: string;
  details: unknown;
  timestamp: Date;
}
