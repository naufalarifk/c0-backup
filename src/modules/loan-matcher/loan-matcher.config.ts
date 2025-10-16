/**
 * Loan Matcher Configuration
 * Default values for loan matching scheduler
 */

export interface LoanMatcherConfig {
  /** Enable/disable loan matcher scheduler */
  schedulerEnabled: boolean;
  /** Cron schedule for loan matching */
  cronSchedule: string;
  /** Run loan matching on module initialization */
  runOnInit: boolean;
  /** Batch size for processing applications */
  batchSize: number;
  /** Maximum total applications to process */
  maxTotalProcessed: number;
}

export const defaultLoanMatcherConfig: LoanMatcherConfig = {
  schedulerEnabled: true,
  cronSchedule: '0 * * * *', // Every hour at minute 0
  runOnInit: false,
  batchSize: 50,
  maxTotalProcessed: 1000,
};
