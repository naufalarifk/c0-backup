/** @see https://chainagnostic.org/CAIPs/caip-2 */
export const BITCOIN_MAINNET_KEY = 'bip122:000000000019d6689c085ae165831e93' as const;
export const BITCOIN_TESTNET_KEY = 'bip122:000000000933ea01ad0ee984209779ba' as const;
export const BSC_MAINNET_KEY = 'eip155:56' as const;
export const BSC_TESTNET_KEY = 'eip155:97' as const;
export const ETHEREUM_MAINNET_KEY = 'eip155:1' as const;
export const ETHEREUM_LOCALNET_KEY = 'eip155:1337' as const;
export const ETHEREUM_HOODI_KEY = 'eip155:560048' as const;

/** @see https://namespaces.chainagnostic.org/solana/caip10 */
export const SOLANA_MAINNET_KEY = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' as const;
export const SOLANA_DEVNET_KEY = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' as const;

/** This is a mock blockchain for testing purposes only */
export const CG_TESTNET_KEY = 'cg:testnet' as const;

export type BlockchainKey =
  | typeof BITCOIN_MAINNET_KEY
  | typeof BITCOIN_TESTNET_KEY
  | typeof BSC_MAINNET_KEY
  | typeof BSC_TESTNET_KEY
  | typeof ETHEREUM_MAINNET_KEY
  | typeof ETHEREUM_LOCALNET_KEY
  | typeof ETHEREUM_HOODI_KEY
  | typeof SOLANA_MAINNET_KEY
  | typeof SOLANA_DEVNET_KEY
  | typeof CG_TESTNET_KEY;
