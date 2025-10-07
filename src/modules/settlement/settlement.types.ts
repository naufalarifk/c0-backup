/**
 * Settlement module types
 */

export interface SettlementConfig {
  enabled: boolean;
  cronSchedule: string;
  targetNetwork: string;
  settlementPercentage: number;
}

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

export const defaultSettlementConfig: SettlementConfig = {
  enabled: true,
  cronSchedule: '0 0 * * *', // Every midnight (00:00 AM)
  targetNetwork: 'eip155:56', // Binance Smart Chain
  settlementPercentage: 50, // 50% of balance
};
