/**
 * Settlement Module Configuration
 * Defines default configuration for the settlement service
 */

export type SettlementConfig = {
  enabled: boolean;
  schedulerEnabled: boolean;
  cronSchedule: string;
  targetPercentage: number;
  targetNetwork: string;
  minSettlementAmount: number;
  runOnInit: boolean;
};

export const defaultSettlementConfig: SettlementConfig = {
  // Enable/disable settlement functionality
  enabled: true,

  // Enable/disable automatic scheduled settlements
  schedulerEnabled: true,

  // Cron schedule for settlement (default: midnight UTC)
  // "0 0 * * *" = At 00:00 (midnight) every day
  cronSchedule: '0 0 * * *',

  // Target percentage for Binance balance (50% = balanced)
  targetPercentage: 50,

  // Target network for settlement (binance or blockchain key)
  targetNetwork: 'binance',

  // Minimum amount to settle (skip if below this)
  minSettlementAmount: 0.01,

  // Run initial settlement on module initialization
  runOnInit: false,
};
