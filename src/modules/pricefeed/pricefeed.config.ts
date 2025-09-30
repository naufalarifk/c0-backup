export type PricefeedConfig = {
  schedulerEnabled: boolean;
  cronExpression: string;
  fetchTimeout: number;
};

export const defaultPricefeedConfig: PricefeedConfig = {
  schedulerEnabled: true,
  cronExpression: '0 */5 * * * *', // Every 5 minutes
  fetchTimeout: 30000, // 30 seconds
};
