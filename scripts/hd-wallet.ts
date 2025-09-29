import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from '@scure/bip39';
import { wordlist as english } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { Keypair } from '@solana/web3.js';
import { derivePath } from 'ed25519-hd-key';
import { mnemonicToAccount } from 'viem/accounts';
import * as bitcoin from 'bitcoinjs-lib';
import * as ecc from 'tiny-secp256k1';
import ECPairFactory from 'ecpair';
import invariant from 'tiny-invariant';

// Initialize ECPair with tiny-secp256k1
const ECPair = ECPairFactory(ecc);
bitcoin.initEccLib(ecc);

// ==================== TYPES & INTERFACES ====================

interface BitcoinAccountInfo {
  address: string;
  privateKey: string;
  wif: string;
  path: string;
  addressType: BitcoinAddressType;
  network: 'mainnet' | 'testnet';
}

interface EthereumAccountInfo {
  address: string;
  privateKey: string;
  path: string;
}

interface SolanaAccountInfo {
  address: string;
  secretKey: string;
  path: string;
}

interface NetworkConfig {
  network: bitcoin.Network;
  coinType: string;
  addressPrefix: string;
}

interface WalletGenerationConfig {
  mnemonic?: string;
  accountCount?: number;
  includeTestnet?: boolean;
  chains?: Array<'ethereum' | 'solana' | 'bitcoin'>;
  bitcoinTypes?: BitcoinAddressType[];
}

interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// ==================== ENUMS & CONSTANTS ====================

enum BitcoinAddressType {
  Legacy = 'legacy',
  SegWit = 'segwit',
  NativeSegWit = 'native-segwit',
  Taproot = 'taproot'
}

enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

// Network configurations with enhanced metadata
const NETWORKS: Record<'mainnet' | 'testnet', NetworkConfig> = {
  mainnet: {
    network: bitcoin.networks.bitcoin,
    coinType: '0',
    addressPrefix: 'Mainnet'
  },
  testnet: {
    network: bitcoin.networks.testnet,
    coinType: '1',
    addressPrefix: 'Testnet'
  }
};

const BIP_PATHS = {
  [BitcoinAddressType.Legacy]: "m/44'/{coinType}'/0'/0/{index}",
  [BitcoinAddressType.SegWit]: "m/49'/{coinType}'/0'/0/{index}",
  [BitcoinAddressType.NativeSegWit]: "m/84'/{coinType}'/0'/0/{index}",
  [BitcoinAddressType.Taproot]: "m/86'/{coinType}'/0'/0/{index}"
} as const;

const ADDRESS_PATTERNS = {
  [BitcoinAddressType.Legacy]: { mainnet: /^1/, testnet: /^[mn]/ },
  [BitcoinAddressType.SegWit]: { mainnet: /^3/, testnet: /^2/ },
  [BitcoinAddressType.NativeSegWit]: { mainnet: /^bc1q/, testnet: /^tb1q/ },
  [BitcoinAddressType.Taproot]: { mainnet: /^bc1p/, testnet: /^tb1p/ }
} as const;

// ==================== CUSTOM ERRORS ====================

class WalletGenerationError extends Error {
  constructor(message: string, public readonly code: string, public readonly details?: any) {
    super(message);
    this.name = 'WalletGenerationError';
  }
}

class ValidationError extends Error {
  constructor(message: string, public readonly field: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ==================== LOGGING UTILITY ====================

class Logger {
  private static logLevel: LogLevel = LogLevel.INFO;

  static setLevel(level: LogLevel): void {
    Logger.logLevel = level;
  }

  private static log(level: LogLevel, message: string, data?: any): void {
    if (level <= Logger.logLevel) {
      const timestamp = new Date().toLocaleString('id-ID', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
      const levelName = LogLevel[level];
      console.log(`[${timestamp}] ${levelName}: ${message}`, data || '');
    }
  }

  static error(message: string, data?: any): void {
    Logger.log(LogLevel.ERROR, message, data);
  }

  static warn(message: string, data?: any): void {
    Logger.log(LogLevel.WARN, message, data);
  }

  static info(message: string, data?: any): void {
    Logger.log(LogLevel.INFO, message, data);
  }

  static debug(message: string, data?: any): void {
    Logger.log(LogLevel.DEBUG, message, data);
  }
}

// ==================== VALIDATION UTILITIES ====================

class ValidationUtils {
  /**
   * Validates mnemonic phrase
   */
  static validateMnemonic(mnemonic: string): ValidationResult {
    const errors: string[] = [];

    if (!mnemonic || typeof mnemonic !== 'string') {
      errors.push('Mnemonic must be a non-empty string');
    } else if (!validateMnemonic(mnemonic, english)) {
      errors.push('Invalid mnemonic phrase');
    }

    return { isValid: errors.length === 0, errors };
  }

  /**
   * Validates Bitcoin address format
   */
  static validateBitcoinAddress(
    address: string,
    addressType: BitcoinAddressType,
    isTestnet = false
  ): boolean {
    try {
      const pattern = ADDRESS_PATTERNS[addressType][isTestnet ? 'testnet' : 'mainnet'];
      return pattern.test(address);
    } catch {
      return false;
    }
  }

  /**
   * Validates configuration object
   */
  static validateConfig(config: WalletGenerationConfig): ValidationResult {
    const errors: string[] = [];

    if (config.mnemonic) {
      const mnemonicValidation = ValidationUtils.validateMnemonic(config.mnemonic);
      if (!mnemonicValidation.isValid) {
        errors.push(...mnemonicValidation.errors);
      }
    }

    if (config.accountCount !== undefined) {
      if (!Number.isInteger(config.accountCount) || config.accountCount < 1 || config.accountCount > 100) {
        errors.push('Account count must be an integer between 1 and 100');
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}

// ==================== CORE WALLET GENERATOR CLASS ====================

class MultiChainWalletGenerator {
  private readonly config: Required<WalletGenerationConfig>;
  private readonly seed: Uint8Array;
  private readonly hdRoot: HDKey;

  constructor(config: WalletGenerationConfig = {}) {
    // Validate configuration
    const validation = ValidationUtils.validateConfig(config);
    if (!validation.isValid) {
      throw new ValidationError(
        `Invalid configuration: ${validation.errors.join(', ')}`,
        'config'
      );
    }

    // Set defaults
    this.config = {
      mnemonic: config.mnemonic || generateMnemonic(english),
      accountCount: config.accountCount || 3,
      includeTestnet: config.includeTestnet ?? true,
      chains: config.chains || ['ethereum', 'solana', 'bitcoin'],
      bitcoinTypes: config.bitcoinTypes || [
        BitcoinAddressType.Legacy,
        BitcoinAddressType.SegWit,
        BitcoinAddressType.NativeSegWit,
        BitcoinAddressType.Taproot
      ]
    };

    // Generate seed and root key
    this.seed = mnemonicToSeedSync(this.config.mnemonic);
    this.hdRoot = HDKey.fromMasterSeed(this.seed);

    Logger.info('MultiChainWalletGenerator initialized', {
      chains: this.config.chains,
      accountCount: this.config.accountCount,
      includeTestnet: this.config.includeTestnet
    });
  }

  /**
   * Get the mnemonic phrase (be careful with this in production!)
   */
  getMnemonic(): string {
    return this.config.mnemonic;
  }

  /**
   * Generate Bitcoin derivation path
   */
  private generateBitcoinPath(
    addressType: BitcoinAddressType,
    coinType: string,
    index: number
  ): string {
    return BIP_PATHS[addressType]
      .replace('{coinType}', coinType)
      .replace('{index}', index.toString());
  }

  /**
   * Create Bitcoin account with validation
   */
  private createBitcoinAccount(
    path: string,
    addressType: BitcoinAddressType,
    networkConfig: NetworkConfig
  ): BitcoinAccountInfo {
    try {
      const child = this.hdRoot.derive(path);

      invariant(child.privateKey && child.publicKey, `Failed to derive key for path: ${path}`);

      const pubkeyBuffer = Buffer.from(child.publicKey);
      const privkeyBuffer = Buffer.from(child.privateKey);

      let address: string | undefined;

      switch (addressType) {
        case BitcoinAddressType.Legacy:
          address = bitcoin.payments.p2pkh({
            pubkey: pubkeyBuffer,
            network: networkConfig.network
          }).address;
          break;

        case BitcoinAddressType.SegWit:
          address = bitcoin.payments.p2sh({
            redeem: bitcoin.payments.p2wpkh({
              pubkey: pubkeyBuffer,
              network: networkConfig.network
            }),
            network: networkConfig.network
          }).address;
          break;

        case BitcoinAddressType.NativeSegWit:
          address = bitcoin.payments.p2wpkh({
            pubkey: pubkeyBuffer,
            network: networkConfig.network
          }).address;
          break;

        case BitcoinAddressType.Taproot:
          address = bitcoin.payments.p2tr({
            pubkey: pubkeyBuffer.subarray(1, 33),
            network: networkConfig.network
          }).address;
          break;

        default:
          throw new WalletGenerationError(
            `Unsupported address type: ${addressType}`,
            'UNSUPPORTED_ADDRESS_TYPE'
          );
      }

      invariant(address, `Failed to generate address for type: ${addressType}`);

      // Validate generated address
      const isTestnet = networkConfig.network === bitcoin.networks.testnet;
      if (!ValidationUtils.validateBitcoinAddress(address, addressType, isTestnet)) {
        throw new WalletGenerationError(
          `Generated address doesn't match expected pattern: ${address}`,
          'ADDRESS_VALIDATION_FAILED',
          { address, addressType, isTestnet }
        );
      }

      return {
        address,
        privateKey: privkeyBuffer.toString('hex'),
        wif: ECPair.fromPrivateKey(privkeyBuffer, { network: networkConfig.network }).toWIF(),
        path,
        addressType,
        network: isTestnet ? 'testnet' : 'mainnet'
      };
    } catch (error) {
      Logger.error('Failed to create Bitcoin account', { path, addressType, error: error.message });
      throw error;
    }
  }

  /**
   * Generate Bitcoin accounts for specific type and network
   */
  generateBitcoinAccounts(
    addressType: BitcoinAddressType,
    networkType: 'mainnet' | 'testnet' = 'mainnet'
  ): BitcoinAccountInfo[] {
    const accounts: BitcoinAccountInfo[] = [];
    const networkConfig = NETWORKS[networkType];

    for (let i = 0; i < this.config.accountCount; i++) {
      const path = this.generateBitcoinPath(addressType, networkConfig.coinType, i);
      const account = this.createBitcoinAccount(path, addressType, networkConfig);
      accounts.push(account);
    }

    Logger.info(`Generated ${accounts.length} Bitcoin ${addressType} ${networkType} accounts`);
    return accounts;
  }

  /**
   * Generate all Bitcoin accounts
   */
  generateAllBitcoinAccounts(): Record<string, BitcoinAccountInfo[]> {
    const result: Record<string, BitcoinAccountInfo[]> = {};

    for (const addressType of this.config.bitcoinTypes) {
      // Mainnet
      result[`${addressType}_mainnet`] = this.generateBitcoinAccounts(addressType, 'mainnet');

      // Testnet (if enabled)
      if (this.config.includeTestnet) {
        result[`${addressType}_testnet`] = this.generateBitcoinAccounts(addressType, 'testnet');
      }
    }

    return result;
  }

  /**
   * Generate Ethereum accounts
   */
  generateEthereumAccounts(): EthereumAccountInfo[] {
    const accounts: EthereumAccountInfo[] = [];

    for (let i = 0; i < this.config.accountCount; i++) {
      try {
        const account = mnemonicToAccount(this.config.mnemonic, { addressIndex: i });
        const hdKey = account.getHdKey();

        invariant(hdKey.privateKey, `Failed to derive private key for index ${i}`);

        accounts.push({
          address: account.address,
          privateKey: Buffer.from(hdKey.privateKey).toString('hex'),
          path: `m/44'/60'/0'/0/${i}`
        });
      } catch (error) {
        Logger.error(`Failed to generate Ethereum account ${i}`, error);
        throw new WalletGenerationError(
          `Failed to generate Ethereum account ${i}: ${error.message}`,
          'ETHEREUM_GENERATION_FAILED',
          { index: i }
        );
      }
    }

    Logger.info(`Generated ${accounts.length} Ethereum accounts`);
    return accounts;
  }

  /**
   * Generate Solana accounts
   */
  generateSolanaAccounts(): SolanaAccountInfo[] {
    const accounts: SolanaAccountInfo[] = [];

    for (let i = 0; i < this.config.accountCount; i++) {
      try {
        const path = `m/44'/501'/${i}'/0'`;
        const { key } = derivePath(path, Buffer.from(this.seed).toString('hex'));
        const keypair = Keypair.fromSeed(key);

        accounts.push({
          address: keypair.publicKey.toBase58(),
          secretKey: Buffer.from(keypair.secretKey).toString('hex'),
          path
        });
      } catch (error) {
        Logger.error(`Failed to generate Solana account ${i}`, error);
        throw new WalletGenerationError(
          `Failed to generate Solana account ${i}: ${error.message}`,
          'SOLANA_GENERATION_FAILED',
          { index: i }
        );
      }
    }

    Logger.info(`Generated ${accounts.length} Solana accounts`);
    return accounts;
  }

  /**
   * Generate all accounts for all configured chains
   */
  generateAllAccounts(): {
    ethereum?: EthereumAccountInfo[];
    solana?: SolanaAccountInfo[];
    bitcoin?: Record<string, BitcoinAccountInfo[]>;
    mnemonic: string;
    timestamp: string;
  } {
    const result: any = {
      mnemonic: this.config.mnemonic,
      timestamp: new Date().toISOString()
    };

    try {
      if (this.config.chains.includes('ethereum')) {
        result.ethereum = this.generateEthereumAccounts();
      }

      if (this.config.chains.includes('solana')) {
        result.solana = this.generateSolanaAccounts();
      }

      if (this.config.chains.includes('bitcoin')) {
        result.bitcoin = this.generateAllBitcoinAccounts();
      }

      Logger.info('Successfully generated all accounts', {
        chains: Object.keys(result).filter(k => k !== 'mnemonic' && k !== 'timestamp')
      });

      return result;
    } catch (error) {
      Logger.error('Failed to generate accounts', error);
      throw error;
    }
  }

  /**
   * Pretty print accounts to console
   */
  printAccounts(): void {
    const accounts = this.generateAllAccounts();

    console.log('='.repeat(80));
    console.log('🚀 HD WALLET GENERATOR');
    console.log('='.repeat(80));
    console.log(`📝 Mnemonic: ${accounts.mnemonic}`);
    console.log(`⏰ Generated: ${accounts.timestamp}\n`);

    if (accounts.ethereum) {
      console.log('💎 ETHEREUM ACCOUNTS');
      console.log('-'.repeat(50));
      accounts.ethereum.forEach((acc, i) => {
        console.log(`[${i}] ${acc.address}`);
        console.log(`    Private Key: ${acc.privateKey}`);
        console.log(`    Path: ${acc.path}\n`);
      });
    }

    if (accounts.solana) {
      console.log('🟣 SOLANA ACCOUNTS');
      console.log('-'.repeat(50));
      accounts.solana.forEach((acc, i) => {
        console.log(`[${i}] ${acc.address}`);
        console.log(`    Secret Key: ${acc.secretKey}`);
        console.log(`    Path: ${acc.path}\n`);
      });
    }

    if (accounts.bitcoin) {
      console.log('₿  BITCOIN ACCOUNTS');
      console.log('-'.repeat(50));
      Object.entries(accounts.bitcoin).forEach(([type, accs]) => {
        console.log(`\n📋 ${type.toUpperCase()}`);
        accs.forEach((acc, i) => {
          console.log(`[${i}] ${acc.address}`);
          console.log(`    Private Key: ${acc.privateKey}`);
          console.log(`    WIF: ${acc.wif}`);
          console.log(`    Path: ${acc.path}`);
        });
      });
    }

    console.log('\n' + '='.repeat(80));
    console.log('✅ GENERATION COMPLETE');
    console.log('='.repeat(80));
  }
}

// ==================== MAIN EXECUTION ====================

function main(): void {
  try {
    // Set logging level
    Logger.setLevel(LogLevel.INFO);

    // Configuration
    const config: WalletGenerationConfig = {
      accountCount: 1,
      includeTestnet: false,
      chains: ['ethereum', 'solana', 'bitcoin'],
      bitcoinTypes: [
        BitcoinAddressType.Legacy,
        BitcoinAddressType.SegWit,
        BitcoinAddressType.NativeSegWit,
        BitcoinAddressType.Taproot
      ]
    };

    // Generate wallet
    const generator = new MultiChainWalletGenerator(config);
    generator.printAccounts();

  } catch (error) {
    Logger.error('Application failed', error);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export {
  MultiChainWalletGenerator,
  BitcoinAddressType,
  ValidationUtils,
  Logger,
  type WalletGenerationConfig,
  type BitcoinAccountInfo,
  type EthereumAccountInfo,
  type SolanaAccountInfo
};
