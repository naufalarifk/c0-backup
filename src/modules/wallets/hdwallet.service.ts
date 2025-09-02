import { Injectable, Logger } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import {
  generateMnemonic as _generateMnemonic,
  mnemonicToSeed,
  mnemonicToSeedSync,
  validateMnemonic,
} from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import * as btc from '@scure/btc-signer';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  sendAndConfirmTransaction,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import axios, { AxiosResponse } from 'axios';
import { BIP32Factory } from 'bip32';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import { eq } from 'drizzle-orm';
import * as ecPair from 'ecpair';
import { ECPairAPI, ECPairFactory, TinySecp256k1Interface } from 'ecpair';
import { ethers } from 'ethers';
import * as ecc from 'tiny-secp256k1';
import * as tinysecp from 'tiny-secp256k1';
import * as accs from 'viem/accounts';

import {
  BitcoinSignatureResponseDto,
  EthereumSignatureResponseDto,
  MultiChainWalletResponseDto,
  SolanaSignatureResponseDto,
} from './hdwalletdto';

type AllowedKeyEntropyBits = 128 | 256;

type GenerateWalletResult = {
  addresses: {
    btc: string;
    eth: `0x${string}`;
    solana: string;
  };
  publicKeys: {
    btc: string;
    eth: string;
    solana: string;
  };
  privateKeys: {
    btc: string;
    eth: string;
    solana: string;
  };
  derivationPaths: {
    btc: string;
    eth: string;
    solana: string;
  };
};

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
  btc: unknown;
  eth: string;
  solana: number;
}

interface WalletConfig {
  network: 'mainnet' | 'testnet';
  rpcEndpoints: {
    bitcoin: string;
    ethereum: string;
    solana: string;
  };
}

interface TransactionParams {
  to: string;
  amount: number;
  from?: string;
}

class MultiChainWallet {
  private config: WalletConfig;
  public connections: {
    solana?: Connection;
    ethereum?: ethers.JsonRpcProvider;
  } = {};

  constructor(config: WalletConfig) {
    this.config = config;
    this.initializeConnections();
  }

  private initializeConnections() {
    this.connections.solana = new Connection(this.config.rpcEndpoints.solana, 'confirmed');

    this.connections.ethereum = new ethers.JsonRpcProvider(this.config.rpcEndpoints.ethereum);

    console.log('this.connection.ethereum', this.connections.ethereum);
  }

  async getSolanaBalance(address: string): Promise<number> {
    if (!this.connections.solana) throw new Error('Solana connection not initialized');

    const publicKey = new PublicKey(address);
    const balance = await this.connections.solana.getBalance(publicKey);
    return balance;
  }

  async sendSolanaTransaction(privateKeyHex: string, params: TransactionParams): Promise<string> {
    if (!this.connections.solana) throw new Error('Solana connection not initialized');

    const privateKeyBytes = Buffer.from(privateKeyHex, 'hex');
    const keypair = Keypair.fromSecretKey(privateKeyBytes);

    const transaction = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: keypair.publicKey,
        toPubkey: new PublicKey(params.to),
        lamports: params.amount,
      }),
    );

    const signature = await sendAndConfirmTransaction(this.connections.solana, transaction, [
      keypair,
    ]);

    return signature;
  }

  async getEthereumBalance(address: string): Promise<string> {
    if (!this.connections.ethereum) throw new Error('Ethereum connection not initialized');

    const balance = await this.connections.ethereum.getBalance(address);
    return ethers.formatEther(balance);
  }

  async sendEthereumTransaction(privateKeyHex: string, params: TransactionParams): Promise<string> {
    if (!this.connections.ethereum) throw new Error('Ethereum connection not initialized');

    const wallet = new ethers.Wallet(`0x${privateKeyHex}`, this.connections.ethereum);

    const [gasPrice, nonce] = await Promise.all([
      this.connections.ethereum.getFeeData(),
      this.connections.ethereum.getTransactionCount(wallet.address),
    ]);

    const transaction = {
      to: params.to,
      value: params.amount.toString(),
      gasLimit: 21000,
      gasPrice: gasPrice.gasPrice,
      nonce: nonce,
    };

    const txResponse = await wallet.sendTransaction(transaction);
    await txResponse.wait();

    return txResponse.hash;
  }

  async getBitcoinBalance(address: string) {
    try {
      const { data } = await axios.get(this.config.rpcEndpoints.bitcoin + `/address/${address}`, {
        headers: {
          'Content-Type': 'application/json',
        },
        maxBodyLength: Infinity,
      });
      return data;
    } catch (error) {
      console.error(error);
    }
  }

  async getBalances(walletResult: GenerateWalletResult): Promise<BlockchainBalances> {
    const [btcBalance, ethBalance, solanaBalance] = await Promise.all([
      this.getBitcoinBalance(walletResult.addresses.btc),
      this.getEthereumBalance(walletResult.addresses.eth),
      this.getSolanaBalance(walletResult.addresses.solana),
    ]);

    return {
      btc: btcBalance,
      eth: ethBalance,
      solana: solanaBalance,
    };
  }
}

@Injectable()
export class HdWalletService {
  private readonly logger = new Logger(HdWalletService.name);
  public wallet: MultiChainWallet;
  constructor() {
    const network: 'mainnet' | 'testnet' = 'testnet';
    const config = this.getNetworkConfig(network);
    this.wallet = new MultiChainWallet(config);
  }

  private getNetworkConfig(network: 'mainnet' | 'testnet'): WalletConfig {
    return {
      network,
      rpcEndpoints: {
        bitcoin: 'https://blockstream.info/testnet/api',
        ethereum: process.env.ETH_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_PROJECT_ID',
        solana: 'https://api.testnet.solana.com',
      },
    };
  }

  validateMnemonic(mnemonic: string): boolean {
    return validateMnemonic(mnemonic, wordlist);
  }

  createHDWallet(mnemonic: string) {
    if (!this.validateMnemonic(mnemonic)) {
      throw new Error('Invalid mnemonic');
    }

    const seed = mnemonicToSeedSync(mnemonic);
    const hdkey = HDKey.fromMasterSeed(seed);

    return hdkey;
  }

  generateAddressFromSecure(entropy: AllowedKeyEntropyBits = 256): string {
    if (entropy !== 128 && entropy !== 256) {
      throw new Error(
        `Invalid entropy. Allowed values are 128 or 256 bits. got: ${String(entropy)}`,
      );
    }

    return _generateMnemonic(wordlist, entropy);
  }

  async demonstrateUsage(blockchainKey: string) {
    try {
      const wallets = await this.generateWalletElaborate({ blockchainKey });
      const balances = await this.wallet.getBalances(wallets[0]);
      console.log('Balances:', balances);
      console.log('wallets', wallets);
      return wallets[0];
    } catch (error) {
      console.error('Error generating wallets:', error);
      throw error;
    }
  }

  async generateWalletElaborate({
    blockchainKey,
  }: {
    blockchainKey: string;
  }): Promise<GenerateWalletResult> {
    const mnemonic = this.generateAddressFromSecure();
    const validatedMnemonic = validateMnemonic(mnemonic, wordlist);

    if (!validatedMnemonic) {
      throw new Error('Invalid mnemonic');
    }

    const seed = await mnemonicToSeed(mnemonic);
    const hdkey = HDKey.fromMasterSeed(seed);

    // Bitcoin derivation
    const btcDerivationPath = `m/44'/0'/0'/0/${blockchainKey}`;
    const btcChildKey = hdkey.derive(btcDerivationPath);

    if (!btcChildKey.privateKey) {
      throw new Error('Failed to derive Bitcoin private key');
    }

    const { address: btcAddress } = btc.p2pkh(
      btcChildKey.publicKey ?? Buffer.alloc(0),
      btc.TEST_NETWORK,
    );

    // Ethereum derivation
    const ethDerivationPath = `m/44'/60'/0'/0/${blockchainKey}`;
    const ethChildKey = hdkey.derive(ethDerivationPath);

    if (!ethChildKey.privateKey) {
      throw new Error('Failed to derive Ethereum private key');
    }

    const ethAddress = accs.privateKeyToAddress(
      `0x${Buffer.from(ethChildKey.privateKey).toString('hex')}`,
    );

    // Solana derivation
    const solanaDerivationPath = `m/44'/501'/0'/0/${blockchainKey}`;
    const solanaChildKey = hdkey.derive(solanaDerivationPath);

    if (!solanaChildKey.privateKey) {
      throw new Error('Failed to derive Solana private key');
    }

    const solanaSeed = solanaChildKey.privateKey.slice(0, 32);
    const solanaKeypair = Keypair.fromSeed(solanaSeed);
    const solanaAddress = solanaKeypair.publicKey.toBase58();

    return {
      addresses: {
        btc: btcAddress,
        eth: ethAddress,
        solana: solanaAddress,
      },
      publicKeys: {
        btc: Buffer.from(btcChildKey.publicKey ?? Buffer.alloc(0)).toString('hex'),
        eth: Buffer.from(ethChildKey.publicKey ?? Buffer.alloc(0)).toString('hex'),
        solana: solanaKeypair.publicKey.toBase58(),
      },
      privateKeys: {
        btc: Buffer.from(btcChildKey.privateKey).toString('hex'),
        eth: Buffer.from(ethChildKey.privateKey).toString('hex'),
        solana: Buffer.from(solanaKeypair.secretKey).toString('hex'),
      },
      derivationPaths: {
        btc: btcDerivationPath,
        eth: ethDerivationPath,
        solana: solanaDerivationPath,
      },
    };
  }

  /**
   * Sign a Bitcoin transaction
   */
  async signBitcoinTransaction(
    inputs: BitcoinTransactionInput[],
    outputs: BitcoinTransactionOutput[],
    privateKeyWif: string,
    feeRate = 10,
  ): Promise<BitcoinSignatureResponseDto> {
    try {
      const ECPair: ECPairAPI = await ECPairFactory(ecc);
      const network = bitcoin.networks.testnet;

      const keyPair = ECPair.fromWIF(privateKeyWif, network);
      const psbt = new bitcoin.Psbt({ network });

      // Add inputs
      for (const input of inputs) {
        psbt.addInput({
          hash: input.txid,
          index: input.vout,
          nonWitnessUtxo: Buffer.from(input.scriptPubKey, 'hex'),
        });
      }

      // Add outputs
      for (const output of outputs) {
        psbt.addOutput({
          address: output.address,
          value: output.value,
        });
      }

      // Calculate fee
      const inputSum = inputs.reduce((sum, input) => sum + input.value, 0);
      const outputSum = outputs.reduce((sum, output) => sum + output.value, 0);
      const fee = Math.max(feeRate * 250, inputSum - outputSum); // Minimum fee

      // Sign all inputs
      for (let i = 0; i < inputs.length; i++) {
        psbt.signInput(i, keyPair);
      }

      psbt.finalizeAllInputs();

      const signedTx = psbt.extractTransaction();
      const signedTransaction = signedTx.toHex();
      const transactionHash = signedTx.getId();

      return {
        signedTransaction,
        transactionHash,
        transactionSize: signedTransaction.length / 2,
        transactionFee: fee,
        signedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Bitcoin transaction signing failed:', error);
      throw new Error(
        `Bitcoin transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Sign an Ethereum transaction
   */
  async signEthereumTransaction(
    params: EthereumTransactionParams,
    privateKeyHex: string,
  ): Promise<EthereumSignatureResponseDto> {
    try {
      if (!this.wallet.connections.ethereum) {
        throw new Error('Ethereum connection not initialized');
      }

      const wallet = new ethers.Wallet(`0x${privateKeyHex}`, this.wallet.connections.ethereum);

      const [feeData, nonce] = await Promise.all([
        this.wallet.connections.ethereum.getFeeData(),
        this.wallet.connections.ethereum.getTransactionCount(wallet.address),
      ]);

      const transaction: ethers.TransactionRequest = {
        to: params.to,
        value: params.value,
        gasLimit: params.gasLimit || 21000,
        gasPrice: params.gasPrice || feeData.gasPrice,
        nonce,
        data: params.data || '0x',
      };

      const signedTx = await wallet.signTransaction(transaction);
      const txResponse = await wallet.sendTransaction(transaction);
      const receipt = await txResponse.wait();

      return {
        transactionHash: txResponse.hash,
        signedTransaction: signedTx,
        gasUsed: receipt?.gasUsed ? Number(receipt.gasUsed) : (transaction.gasLimit as number),
        gasPrice: transaction.gasPrice?.toString() || '0',
        nonce,
        signedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Ethereum transaction signing failed:', error);
      throw new Error(
        `Ethereum transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Sign a Solana transaction
   */
  /**
   * Sign a Solana transaction
   */
  async signSolanaTransaction(
    params: SolanaTransactionParams,
    privateKeyBase58: string,
  ): Promise<SolanaSignatureResponseDto> {
    try {
      if (!this.wallet.connections.solana) {
        throw new Error('Solana connection not initialized');
      }

      const privateKeyBytes = Buffer.from(privateKeyBase58, 'hex');
      const keypair = Keypair.fromSecretKey(privateKeyBytes);

      // Get recent blockhash
      const { blockhash } = await this.wallet.connections.solana.getLatestBlockhash();

      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: keypair.publicKey,
      });

      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(params.to),
          lamports: params.amount,
        }),
      );

      // Add memo if provided
      if (params.memo) {
        const memoInstruction = {
          keys: [],
          programId: new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr'),
          data: Buffer.from(params.memo, 'utf8'),
        };
        transaction.add(memoInstruction);
      }

      // Sign and send transaction
      const signature = await sendAndConfirmTransaction(
        this.wallet.connections.solana,
        transaction,
        [keypair],
      );

      // Get transaction fee
      const feeResponse = await this.wallet.connections.solana.getFeeForMessage(
        transaction.compileMessage(),
      );
      const transactionFee = feeResponse.value || 5000; // Default fee

      return {
        signature,
        recentBlockhash: blockhash,
        transactionFee,
        signedAt: new Date().toISOString(),
      };
    } catch (error) {
      this.logger.error('Solana transaction signing failed:', error);
      throw new Error(
        `Solana transaction signing failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Get wallet balances for all chains
   */
  async getWalletBalances(addresses: {
    btc: string;
    eth: string;
    solana: string;
  }): Promise<BlockchainBalances> {
    try {
      const [btcBalance, ethBalance, solanaBalance] = await Promise.all([
        this.wallet.getBitcoinBalance(addresses.btc),
        this.wallet.getEthereumBalance(addresses.eth),
        this.wallet.getSolanaBalance(addresses.solana),
      ]);

      return {
        btc: btcBalance,
        eth: ethBalance,
        solana: solanaBalance,
      };
    } catch (error) {
      this.logger.error('Failed to get wallet balances:', error);
      throw new Error(
        `Failed to get wallet balances: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate private key format for different blockchains
   */
  validatePrivateKey(privateKey: string, blockchain: 'btc' | 'eth' | 'solana'): boolean {
    try {
      switch (blockchain) {
        case 'btc': {
          // Bitcoin WIF format validation
          const ECPair: ECPairAPI = ECPairFactory(ecc);
          ECPair.fromWIF(privateKey, bitcoin.networks.testnet);
          return true;
        }
        case 'eth': {
          // Ethereum hex private key validation
          const hexRegex = /^[0-9a-fA-F]{64}$/;
          return hexRegex.test(privateKey);
        }
        case 'solana':
          // Solana base58 private key validation
          try {
            const keyBytes = Buffer.from(privateKey, 'hex');
            return keyBytes.length === 64; // 64 bytes for Solana keypair
          } catch {
            return false;
          }
        default:
          return false;
      }
    } catch {
      return false;
    }
  }

  /**
   * Convert private key between formats
   */
  convertPrivateKey(
    privateKey: string,
    from: 'hex' | 'wif' | 'base58',
    to: 'hex' | 'wif' | 'base58',
  ): string {
    if (from === to) return privateKey;

    try {
      switch (`${from}->${to}`) {
        case 'hex->wif': {
          const ECPair: ECPairAPI = ECPairFactory(ecc);
          const keyPair = ECPair.fromPrivateKey(Buffer.from(privateKey, 'hex'));
          return keyPair.toWIF();
        }
        case 'wif->hex': {
          const ECPairFromWIF: ECPairAPI = ECPairFactory(ecc);
          const keyPairFromWIF = ECPairFromWIF.fromWIF(privateKey);
          return keyPairFromWIF.privateKey?.toString('hex') || '';
        }
        default:
          throw new Error(`Conversion from ${from} to ${to} not implemented`);
      }
    } catch (error) {
      throw new Error(
        `Private key conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }
}
