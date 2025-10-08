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
}

export interface BlockchainBalance {
  blockchainKey: string;
  balance: string;
  currency: string;
}
