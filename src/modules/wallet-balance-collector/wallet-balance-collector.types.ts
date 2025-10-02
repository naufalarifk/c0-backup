export interface WalletBalanceCollectionJobData {
  invoiceId: string;
  blockchainKey: string;
  walletAddress: string;
  walletDerivationPath: string;
  transactionHash?: string;
  paidAmount?: string;
}
