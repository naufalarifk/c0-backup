export const BlockchainNetworkEnum = {
  EthereumMainnet: 'eip155:1' as const,
  BSCMainnet: 'eip155:56' as const,
  EthereumSepolia: 'eip155:11155111' as const,
  SolanaMainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' as const,
  BitcoinMainnet: 'bip122:000000000019d6689c085ae165831e93' as const,
} as const;

// Allow any string for BlockchainNetwork to support dynamic blockchain keys
export type BlockchainNetwork = string;

export function assertIsBlockchainNetwork(value: unknown): asserts value is BlockchainNetwork {
  if (typeof value !== 'string') {
    throw new Error(`Invalid blockchain network: ${value}`);
  }
}

export function getBlockchainType(network: BlockchainNetwork): 'evm' | 'solana' | 'bitcoin' {
  if (network.startsWith('eip155:')) return 'evm';
  if (network.startsWith('solana:')) return 'solana';
  if (network.startsWith('bip122:')) return 'bitcoin';
  throw new Error(`Unknown blockchain type for network: ${network}`);
}

export interface BalanceCollectionRequest {
  blockchainKey: BlockchainNetwork;
  walletAddress: string;
  walletDerivationPath: string;
  transactionHash?: string;
  paidAmount?: string;
}

export interface BalanceCollectionResult {
  success: boolean;
  balance: string;
  transferredAmount?: string;
  transactionHash?: string;
  error?: string;
  skipped?: boolean;
  skipReason?: string;
}

export interface WalletBalanceCollectionJobData extends BalanceCollectionRequest {}
