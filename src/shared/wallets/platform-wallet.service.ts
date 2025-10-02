import { Injectable, Logger } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';

import { CryptographyService } from '../cryptography/cryptography.service';
import { AppConfigService } from '../services/app-config.service';
import { WalletFactory } from './Iwallet.service';
import { IWallet } from './Iwallet.types';

export interface PlatformHotWallet {
  blockchainKey: string;
  address: string;
  derivationPath: string;
  bip44CoinType: number;
  wallet: IWallet;
}

@Injectable()
export class PlatformWalletService {
  private readonly logger = new Logger(PlatformWalletService.name);
  private masterKey?: HDKey;
  private loadingMasterKey?: Promise<HDKey>;
  private readonly hotWalletCache = new Map<string, Promise<PlatformHotWallet>>();

  constructor(
    private readonly walletFactory: WalletFactory,
    private readonly appConfigService: AppConfigService,
    private readonly cryptographyService: CryptographyService,
  ) {}

  async getMasterKey(): Promise<HDKey> {
    if (this.masterKey) {
      return this.masterKey;
    }

    if (this.loadingMasterKey) {
      return this.loadingMasterKey;
    }

    this.loadingMasterKey = this.loadMasterKey();
    try {
      this.masterKey = await this.loadingMasterKey;
      return this.masterKey;
    } finally {
      this.loadingMasterKey = undefined;
    }
  }

  async deriveInvoiceWallet(
    blockchainKey: string,
    invoiceId: number,
  ): Promise<{
    wallet: IWallet;
    address: string;
    derivationPath: string;
  }> {
    if (!Number.isInteger(invoiceId) || invoiceId <= 0) {
      throw new Error(`Invoice ID must be positive integer. Received: ${invoiceId}`);
    }

    const masterKey = await this.getMasterKey();
    const walletService = this.walletFactory.getWalletService(blockchainKey);
    const derivationPath = walletService.getInvoiceDerivationPath(invoiceId);
    const wallet = await walletService.derivedPathToWallet({
      masterKey,
      derivationPath,
    });
    const address = await wallet.getAddress();

    return { wallet, address, derivationPath };
  }

  async getHotWallet(blockchainKey: string): Promise<PlatformHotWallet> {
    let loadingHotWallet = this.hotWalletCache.get(blockchainKey);

    if (!loadingHotWallet) {
      loadingHotWallet = this.buildHotWallet(blockchainKey);
      this.hotWalletCache.set(blockchainKey, loadingHotWallet);
    }

    try {
      return await loadingHotWallet;
    } catch (error) {
      this.hotWalletCache.delete(blockchainKey);
      throw error;
    }
  }

  private async buildHotWallet(blockchainKey: string): Promise<PlatformHotWallet> {
    const masterKey = await this.getMasterKey();
    const walletService = this.walletFactory.getWalletService(blockchainKey);
    const wallet = await walletService.getHotWallet(masterKey);
    const address = await wallet.getAddress();

    return {
      blockchainKey,
      wallet,
      address,
      derivationPath: walletService.getHotWalletDerivationPath(),
      bip44CoinType: walletService.bip44CoinType,
    };
  }

  private async loadMasterKey(): Promise<HDKey> {
    const walletConfig = this.appConfigService.walletConfig;

    if (walletConfig.enableTestMode && walletConfig.platformMasterMnemonic) {
      this.logger.warn('Using mnemonic from WALLET_TEST_MODE for platform master key');
      const seed = await mnemonicToSeed(walletConfig.platformMasterMnemonic);
      return HDKey.fromMasterSeed(seed);
    }

    const cryptographyConfig = this.appConfigService.cryptographyConfig;

    if (cryptographyConfig.engine !== 'vault') {
      throw new Error(
        'Platform wallet requires Vault-based cryptography in production. Set CRYPTOGRAPHY_ENGINE=vault',
      );
    }

    this.logger.log('Retrieving platform wallet seed from Vault');

    const secretData = await this.cryptographyService.getSecret('wallet/platform-seed');

    if (!secretData || typeof secretData !== 'object') {
      throw new Error('Platform wallet seed not found in Vault secret at wallet/platform-seed');
    }

    const encryptedSeed = (secretData as Record<string, unknown>).encrypted_seed;

    if (typeof encryptedSeed !== 'string' || encryptedSeed.length === 0) {
      throw new Error('Vault secret wallet/platform-seed missing encrypted_seed value');
    }

    const decryptResult = await this.cryptographyService.decrypt('platform-wallet', encryptedSeed);
    const seedHex = decryptResult.plaintext;

    if (!seedHex) {
      throw new Error('Decrypted platform wallet seed is empty');
    }

    const seedBuffer = Buffer.from(seedHex, 'hex');

    if (seedBuffer.length === 0) {
      throw new Error('Platform wallet seed buffer is empty after decoding');
    }

    return HDKey.fromMasterSeed(seedBuffer);
  }
}
