import { Injectable, Logger } from '@nestjs/common';

/**
 * Maps between CryptoGadai currency token IDs and Binance asset symbols/networks
 *
 * Example mappings:
 * - 'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7' -> { asset: 'USDT', network: 'ETH' }
 * - 'eip155:56/bep20:0x55d398326f99059ff775485246999027b3197955' -> { asset: 'USDT', network: 'BSC' }
 * - 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/spl-token:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' -> { asset: 'USDT', network: 'SOL' }
 */

export interface BinanceAssetMapping {
  asset: string;
  network: string;
}

@Injectable()
export class BinanceAssetMapperService {
  private readonly logger = new Logger(BinanceAssetMapperService.name);

  /**
   * Maps CAIP-2 chain identifiers to Binance network codes
   * Structure: { chainId: network }
   */
  private readonly CHAIN_TO_NETWORK: Record<string, string> = {
    // EIP-155 chains
    'eip155:1': 'ETH', // Ethereum Mainnet
    'eip155:56': 'BSC', // Binance Smart Chain
    'eip155:137': 'MATIC', // Polygon
    // Non-EIP chains
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'SOL', // Solana Mainnet
    'tron:0x': 'TRX', // Tron
    'bitcoin:000000000019d6689c085ae165831e93': 'BTC', // Bitcoin (first 32 chars of genesis hash)
  };

  /**
   * Alternative network identifiers for backward compatibility
   * Structure: { keyword: network }
   */
  private readonly NETWORK_KEYWORDS: Record<string, string> = {
    ethereum: 'ETH',
    bsc: 'BSC',
    binance: 'BSC',
    polygon: 'MATIC',
    matic: 'MATIC',
    solana: 'SOL',
    tron: 'TRX',
    bitcoin: 'BTC',
  };

  // Standard token addresses for common assets
  private readonly TOKEN_MAPPINGS: Record<string, BinanceAssetMapping> = {
    // USDT mappings
    'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7': { asset: 'USDT', network: 'ETH' },
    'eip155:56/bep20:0x55d398326f99059ff775485246999027b3197955': { asset: 'USDT', network: 'BSC' },
    'eip155:137/erc20:0xc2132d05d31c914a87c6611c10748aeb04b58e8f': {
      asset: 'USDT',
      network: 'MATIC',
    },
    'tron:0x/trc20:TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t': { asset: 'USDT', network: 'TRX' },
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/spl-token:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB':
      {
        asset: 'USDT',
        network: 'SOL',
      },

    // USDC mappings
    'eip155:1/erc20:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { asset: 'USDC', network: 'ETH' },
    'eip155:56/bep20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d': { asset: 'USDC', network: 'BSC' },
    'eip155:137/erc20:0x2791bca1f2de4661ed88a30c99a7a9449aa84174': {
      asset: 'USDC',
      network: 'MATIC',
    },
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/spl-token:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v':
      {
        asset: 'USDC',
        network: 'SOL',
      },

    // BNB mappings
    'eip155:56': { asset: 'BNB', network: 'BSC' },
    'eip155:1/erc20:0xb8c77482e45f1f44de1745f52c74426c631bdd52': { asset: 'BNB', network: 'ETH' },

    // ETH mappings
    'eip155:1': { asset: 'ETH', network: 'ETH' },
    'eip155:56/bep20:0x2170ed0880ac9a755fd29b2688956bd959f933f8': { asset: 'ETH', network: 'BSC' },

    // BTC mappings (wrapped)
    'eip155:1/erc20:0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { asset: 'BTC', network: 'ETH' },
    'eip155:56/bep20:0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c': { asset: 'BTC', network: 'BSC' },

    // SOL mappings
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': { asset: 'SOL', network: 'SOL' },
    'eip155:56/bep20:0x570a5d26f7765ecb712c0924e4de545b89fd43df': { asset: 'SOL', network: 'BSC' },

    // DAI mappings
    'eip155:1/erc20:0x6b175474e89094c44da98b954eedeac495271d0f': { asset: 'DAI', network: 'ETH' },
    'eip155:56/bep20:0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3': { asset: 'DAI', network: 'BSC' },
    'eip155:137/erc20:0x8f3cf7ad23cd3cadbd9735aff958023239c6a063': {
      asset: 'DAI',
      network: 'MATIC',
    },
  };

  /**
   * Convert a currency token ID to Binance asset and network
   */
  tokenToBinanceAsset(currencyTokenId: string): BinanceAssetMapping | null {
    // Normalize to lowercase for case-insensitive matching
    const normalized = currencyTokenId.toLowerCase();

    // Try exact match first (case-insensitive)
    for (const [key, value] of Object.entries(this.TOKEN_MAPPINGS)) {
      if (key.toLowerCase() === normalized) {
        this.logger.debug(`Mapped ${currencyTokenId} -> ${value.asset} on ${value.network}`);
        return value;
      }
    }

    // Try to extract asset from token ID as fallback
    const fallback = this.extractAssetFromTokenId(currencyTokenId);
    if (fallback) {
      this.logger.warn(
        `Using fallback mapping for ${currencyTokenId} -> ${fallback.asset} on ${fallback.network}`,
      );
      return fallback;
    }

    this.logger.error(`No Binance mapping found for currency token: ${currencyTokenId}`);
    return null;
  }

  /**
   * Extract CAIP-2 chain identifier from token ID
   * Examples:
   * - 'eip155:1/erc20:0xabc...' -> 'eip155:1'
   * - 'eip155:56' -> 'eip155:56'
   * - 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/spl-token:...' -> 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
   */
  private extractChainId(identifier: string): string | null {
    const parts = identifier.split('/');
    return parts.length > 0 ? parts[0] : null;
  }

  /**
   * Parse network from CAIP identifier using centralized mappings
   */
  private parseNetwork(identifier: string): string | null {
    // Extract chain part from CAIP-19 format
    const chainId = this.extractChainId(identifier);
    if (!chainId) {
      return null;
    }

    // Try exact CAIP-2 match first
    const exactMatch = this.CHAIN_TO_NETWORK[chainId.toLowerCase()];
    if (exactMatch) {
      return exactMatch;
    }

    // Try prefix matching for chains with different genesis hashes
    const lowerChain = chainId.toLowerCase();
    for (const [knownChain, network] of Object.entries(this.CHAIN_TO_NETWORK)) {
      if (lowerChain.startsWith(knownChain)) {
        return network;
      }
    }

    // Try keyword matching as last resort
    for (const [keyword, network] of Object.entries(this.NETWORK_KEYWORDS)) {
      if (lowerChain.includes(keyword)) {
        return network;
      }
    }

    return null;
  }

  /**
   * Attempt to extract asset info from token ID as fallback
   * This is less reliable but can handle unmapped tokens
   */
  private extractAssetFromTokenId(tokenId: string): BinanceAssetMapping | null {
    const network = this.parseNetwork(tokenId);
    if (!network) {
      return null;
    }

    // For native tokens (no '/' in the token ID)
    if (!tokenId.includes('/')) {
      const chainId = tokenId.toLowerCase();

      if (chainId.startsWith('eip155:1')) {
        return { asset: 'ETH', network: 'ETH' };
      }
      if (chainId.startsWith('eip155:56')) {
        return { asset: 'BNB', network: 'BSC' };
      }
      if (chainId.startsWith('solana:')) {
        return { asset: 'SOL', network: 'SOL' };
      }
      if (chainId.startsWith('bitcoin:')) {
        return { asset: 'BTC', network: 'BTC' };
      }
    }

    return null;
  }

  /**
   * Get all supported currency token IDs
   */
  getSupportedTokens(): string[] {
    return Object.keys(this.TOKEN_MAPPINGS);
  }

  /**
   * Check if a currency token is supported for Binance operations
   */
  isTokenSupported(currencyTokenId: string): boolean {
    return this.tokenToBinanceAsset(currencyTokenId) !== null;
  }

  /**
   * Get Binance network name for a blockchain key
   * Maps blockchain_key format to Binance network format
   *
   * Accepts:
   * - CAIP-2 chain IDs: 'eip155:1', 'eip155:56', 'solana:5eykt4...'
   * - CAIP-19 token IDs: 'eip155:1/erc20:0xabc...'
   * - Human-readable names: 'ethereum', 'bsc', 'polygon', 'solana'
   */
  blockchainKeyToBinanceNetwork(blockchainKey: string): string | null {
    const network = this.parseNetwork(blockchainKey);

    if (!network) {
      this.logger.warn(`Unknown blockchain key for Binance network mapping: ${blockchainKey}`);
    }

    return network;
  }
}
