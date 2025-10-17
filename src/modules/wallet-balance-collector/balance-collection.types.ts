import {
  BITCOIN_MAINNET_KEY,
  BSC_MAINNET_KEY,
  ETHEREUM_MAINNET_KEY,
  SOLANA_MAINNET_KEY,
} from '../../shared/constants/blockchain';

export const BlockchainNetworkEnum = {
  EthereumMainnet: ETHEREUM_MAINNET_KEY,
  BSCMainnet: BSC_MAINNET_KEY,
  SolanaMainnet: SOLANA_MAINNET_KEY,
  BitcoinMainnet: BITCOIN_MAINNET_KEY,
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
