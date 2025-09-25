import { PublicKey } from '@solana/web3.js';
import * as bitcoin from 'bitcoinjs-lib';
import { isAddress } from 'viem';

/**
 * Validate blockchain addresses using existing dependencies
 */
export class AddressValidator {
  /**
   * Validate Ethereum/EVM addresses (Ethereum, BSC, etc.)
   * Uses viem's isAddress with built-in checksum validation
   */
  static validateEthereumAddress(address: string): boolean {
    try {
      // isAddress with default strict=true includes checksum validation
      return isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Validate Bitcoin addresses
   */
  static validateBitcoinAddress(address: string): boolean {
    try {
      // Try Base58Check (Legacy and P2SH addresses)
      try {
        bitcoin.address.fromBase58Check(address);
        return true;
      } catch {
        // Try Bech32 (SegWit addresses)
        try {
          bitcoin.address.fromBech32(address);
          return true;
        } catch {
          return false;
        }
      }
    } catch {
      return false;
    }
  }

  /**
   * Validate Solana addresses (Base58 format with curve validation)
   */
  static validateSolanaAddress(address: string): boolean {
    try {
      // Validate Base58 format and ensure it's a valid public key on the curve
      const publicKey = new PublicKey(address);
      return PublicKey.isOnCurve(publicKey.toBytes());
    } catch {
      return false;
    }
  }

  /**
   * Main validation function based on blockchain key
   */
  static validateAddress(blockchainKey: string, address: string): boolean {
    // Handle special cases and extract namespace from CAIP-2 format
    if (blockchainKey === 'crosschain') {
      // For crosschain, we need to validate against common address formats
      return this.validateCrosschainAddress(address);
    }

    const [namespace] = blockchainKey.split(':');

    switch (namespace) {
      case 'eip155':
        // Ethereum, BSC, etc.
        return this.validateEthereumAddress(address);

      case 'bip122':
        // Bitcoin
        return this.validateBitcoinAddress(address);

      case 'solana':
        // Solana
        return this.validateSolanaAddress(address);

      default:
        // For unsupported blockchains, return true (basic regex validation only)
        return true;
    }
  }

  /**
   * Validate crosschain addresses (multiple format support)
   */
  static validateCrosschainAddress(address: string): boolean {
    // Try different formats for crosschain addresses
    return (
      this.validateEthereumAddress(address) ||
      this.validateBitcoinAddress(address) ||
      this.validateSolanaAddress(address)
    );
  }

  /**
   * Get blockchain type from CAIP-2 blockchain key
   */
  static getBlockchainType(blockchainKey: string): string {
    // Handle special cases first
    if (blockchainKey === 'crosschain') {
      return 'Cross-Chain';
    }

    const [namespace, reference] = blockchainKey.split(':');

    switch (namespace) {
      case 'eip155':
        switch (reference) {
          case '1':
            return 'Ethereum Mainnet';
          case '56':
            return 'BSC Mainnet';
          case '42161':
            return 'Arbitrum One';
          case '10':
            return 'Optimism';
          default:
            return `EVM Chain (${reference})`;
        }
      case 'bip122':
        if (reference === '000000000019d6689c085ae165831e93') {
          return 'Bitcoin Mainnet';
        }
        return 'Bitcoin';
      case 'solana':
        if (reference === '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp') {
          return 'Solana Mainnet';
        }
        return 'Solana';
      default:
        return `Unknown (${namespace})`;
    }
  }
}
