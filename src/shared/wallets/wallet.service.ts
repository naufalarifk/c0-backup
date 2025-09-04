import { Injectable, Logger } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import {
  generateMnemonic as _generateMnemonic,
  mnemonicToSeed,
  mnemonicToSeedSync,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

import { BtcWalletService } from './btc-wallet.service';
import { EthWalletService } from './eth-wallet.service';
import {
  BitcoinSignatureResponseDto,
  EthereumSignatureResponseDto,
  MultiChainWalletResponseDto,
  SolanaSignatureResponseDto,
} from './hdwalletdto';
import { SolWalletService } from './sol-wallet.service';

//////////////////////////////////////////////////////////////////////////////////////////////////////
//                                                                                                  //
//asumsi semua mainnet, untuk kedepan setiap blockchain bakal punya class WalletService sendiri,    //
//  misal: BtcMainnetWalletService, BtcTestnetWalletService, etc                                    //
//                                                                                                  //
//////////////////////////////////////////////////////////////////////////////////////////////////////

type AllowedKeyEntropyBits = 128 | 256;

interface BitcoinTransactionInput {
  txid: string;
  vout: number;
  value: number;
  scriptPubKey: string;
}

interface BitcoinTransactionOutput {
  address: string;
  value: number;
}

interface EthereumTransactionParams {
  to: string;
  value: string;
  gasLimit?: number;
  gasPrice?: string;
  data?: string;
}

interface SolanaTransactionParams {
  to: string;
  amount: number;
  memo?: string;
}

interface BlockchainBalances {
  btc: {
    balance: number;
    confirmed: number;
    unconfirmed: number;
    error?: string;
  };
  eth: string;
  solana: number;
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly btcWalletService: BtcWalletService,
    private readonly ethWalletService: EthWalletService,
    private readonly solWalletService: SolWalletService,
  ) {}

  /**
   * Validate BIP39 mnemonic phrase
   */
  validateMnemonic(mnemonic: string): boolean {
    return validateMnemonic(mnemonic, wordlist);
  }

  /**
   * Create HD wallet from mnemonic
   */
  createHDWallet(mnemonic: string): HDKey {
    if (!this.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    const seed = mnemonicToSeedSync(mnemonic);
    const hdkey = HDKey.fromMasterSeed(seed);

    return hdkey;
  }

  /**
   * Generate new mnemonic phrase
   */
  generateMnemonic(entropy: AllowedKeyEntropyBits = 256): string {
    if (entropy !== 128 && entropy !== 256) {
      throw new Error(
        `Invalid entropy. Allowed values are 128 or 256 bits. got: ${String(entropy)}`,
      );
    }

    return _generateMnemonic(wordlist, entropy);
  }

  /**
   * Generate multi-chain wallet from mnemonic
   */
  async generateMultiChainWallet(
    mnemonic: string,
    accountIndex: number = 0,
  ): Promise<MultiChainWalletResponseDto> {
    if (!this.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    const seed = await mnemonicToSeed(mnemonic);
    const hdkey = HDKey.fromMasterSeed(seed);

    // Generate wallets for each blockchain
    const btcWallet = this.btcWalletService.generateWallet(hdkey, accountIndex, 0);
    const ethWallet = this.ethWalletService.generateWallet(hdkey, accountIndex, 0);
    const solWallet = this.solWalletService.generateWallet(hdkey, accountIndex, 0);

    return {
      addresses: {
        btc: btcWallet.address,
        eth: ethWallet.address,
        solana: solWallet.address,
      },
      publicKeys: {
        btc: btcWallet.publicKey,
        eth: ethWallet.publicKey,
        solana: solWallet.publicKey,
      },
      privateKeys: {
        btc: btcWallet.privateKey,
        eth: ethWallet.privateKey,
        solana: solWallet.privateKey,
      },
      derivationPaths: {
        btc: btcWallet.derivationPath,
        eth: ethWallet.derivationPath,
        solana: solWallet.derivationPath,
      },
      createdAt: new Date().toISOString(),
    };
  }

  /**
   * Get balances for all blockchains
   */
  async getMultiChainBalances(addresses: {
    btc: string;
    eth: string;
    solana: string;
  }): Promise<BlockchainBalances> {
    // Use Promise.allSettled to handle individual failures gracefully
    const [btcResult, ethResult, solanaResult] = await Promise.allSettled([
      this.btcWalletService.getBalance(addresses.btc),
      this.ethWalletService.getBalance(addresses.eth),
      this.solWalletService.getBalance(addresses.solana),
    ]);

    return {
      btc:
        btcResult.status === 'fulfilled'
          ? btcResult.value
          : { balance: 0, confirmed: 0, unconfirmed: 0, error: 'Failed to fetch Bitcoin balance' },
      eth:
        ethResult.status === 'fulfilled'
          ? ethResult.value
          : 'Error: Failed to fetch Ethereum balance',
      solana: solanaResult.status === 'fulfilled' ? solanaResult.value : -1, // Use -1 to indicate error
    };
  }

  /**
   * Sign Bitcoin transaction
   */
  signBitcoinTransaction(
    privateKeyHex: string,
    inputs: BitcoinTransactionInput[],
    outputs: BitcoinTransactionOutput[],
  ): Promise<BitcoinSignatureResponseDto> {
    return this.btcWalletService.signTransaction(privateKeyHex, inputs, outputs);
  }

  /**
   * Sign Ethereum transaction
   */
  async signEthTransaction(
    privateKeyHex: string,
    params: EthereumTransactionParams,
  ): Promise<EthereumSignatureResponseDto> {
    return await this.ethWalletService.signTransaction(privateKeyHex, params);
  }

  /**
   * Sign Solana transaction
   */
  async signSolanaTransaction(
    privateKeyHex: string,
    params: SolanaTransactionParams,
  ): Promise<SolanaSignatureResponseDto> {
    return await this.solWalletService.signSolanaTransaction(privateKeyHex, params);
  }

  /**
   * Demonstrate usage (for testing)
   */
  async demonstrateUsage(): Promise<MultiChainWalletResponseDto> {
    try {
      const mnemonic = this.generateMnemonic();
      const wallet = await this.generateMultiChainWallet(mnemonic);
      const balances = await this.getMultiChainBalances(wallet.addresses);

      this.logger.log('Generated wallet:', wallet);
      this.logger.log('Balances:', balances);

      return wallet;
    } catch (error) {
      this.logger.error('Error generating wallets:', error);
      throw error;
    }
  }
}
