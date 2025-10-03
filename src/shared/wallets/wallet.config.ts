import { Injectable } from '@nestjs/common';

import { HDKey } from '@scure/bip32';
import { mnemonicToSeed } from '@scure/bip39';

import { CryptographyService } from '../cryptography/cryptography.service';
import { AppConfigService } from '../services/app-config.service';
import { TelemetryLogger } from '../telemetry.logger';

export class MasterWallet {
  constructor(public readonly key: HDKey) {}
  get privateKey(): Uint8Array | null {
    return this.key.privateKey;
  }
  derive(path: string): MasterWallet {
    const derivedKey = this.key.derive(path);
    return new MasterWallet(derivedKey);
  }
}

@Injectable()
export class WalletConfig {
  readonly logger = new TelemetryLogger(WalletConfig.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly cryptography: CryptographyService,
  ) {}

  #loadedMasterKey?: MasterWallet;
  async getMasterKey(): Promise<MasterWallet> {
    if (this.#loadedMasterKey) {
      return this.#loadedMasterKey;
    }
    this.#loadedMasterKey = await this.loadMasterKey();
    return this.#loadedMasterKey;
  }

  private async loadMasterKey(): Promise<MasterWallet> {
    const walletConfig = this.appConfig.walletConfig;

    if (walletConfig.enableTestMode && walletConfig.platformMasterMnemonic) {
      this.logger.warn('Using mnemonic from WALLET_TEST_MODE for platform master key');
      const seed = await mnemonicToSeed(walletConfig.platformMasterMnemonic);
      const hdKey = HDKey.fromMasterSeed(seed);
      return new MasterWallet(hdKey);
    }

    const cryptographyConfig = this.appConfig.cryptographyConfig;

    if (cryptographyConfig.engine !== 'vault') {
      throw new Error(
        'Platform wallet requires Vault-based cryptography in production. Set CRYPTOGRAPHY_ENGINE=vault',
      );
    }

    const secretData = await this.cryptography.getSecret('wallet/platform-seed');

    if (!secretData || typeof secretData !== 'object') {
      throw new Error('Platform wallet seed not found in Vault secret at wallet/platform-seed');
    }

    const encryptedSeed = (secretData as Record<string, unknown>).encrypted_seed;

    if (typeof encryptedSeed !== 'string' || encryptedSeed.length === 0) {
      throw new Error('Vault secret wallet/platform-seed missing encrypted_seed value');
    }

    const decryptResult = await this.cryptography.decrypt('platform-wallet', encryptedSeed);
    const seedHex = decryptResult.plaintext;

    if (!seedHex) {
      throw new Error('Decrypted platform wallet seed is empty');
    }

    const seedBuffer = Buffer.from(seedHex, 'hex');

    if (seedBuffer.length === 0) {
      throw new Error('Platform wallet seed buffer is empty after decoding');
    }

    const hdKey = HDKey.fromMasterSeed(seedBuffer);
    return new MasterWallet(hdKey);
  }
}
