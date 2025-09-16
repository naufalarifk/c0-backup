import { getRandomValues } from 'crypto';

import { Injectable } from '@nestjs/common';

import { DecryptionResult, EncryptionResult } from './cryptography.dto';
import { CryptographyServiceError } from './cryptography.error';
import { CryptographyService } from './cryptography.service';

type LocalCryptographyServiceOptions = {
  cryptographyConfig: {
    localEncryptionKey: string; // Hex-encoded 32-byte key for AES-256-GCM
  };
};

@Injectable()
export class LocalCryptographyService extends CryptographyService {
  private encryptionKey: string;
  private secretMap: Map<string, Record<string, string>> = new Map();

  constructor(private appConfig: LocalCryptographyServiceOptions) {
    super();
    this.encryptionKey = this.appConfig.cryptographyConfig.localEncryptionKey;
  }

  async getSecret(path: string): Promise<unknown> {
    return this.secretMap.get(path) || null;
  }

  async writeSecret(path: string, data: Record<string, string>) {
    this.secretMap.set(path, data);
  }

  async deleteSecret(path: string) {
    this.secretMap.delete(path);
  }

  async encrypt(keyName: string, plaintext: string): Promise<EncryptionResult> {
    try {
      const iv = getRandomValues(new Uint8Array(12));

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        Buffer.from(this.encryptionKey, 'hex'),
        'AES-GCM',
        false,
        ['encrypt'],
      );

      const encrypted = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        cryptoKey,
        Buffer.from(`${keyName}.${plaintext}`, 'utf-8'),
      );

      return {
        ciphertext:
          Buffer.from(encrypted).toString('base64') + '.' + Buffer.from(iv).toString('base64'),
        keyId: keyName,
      };
    } catch (error) {
      throw new CryptographyServiceError('Encryption failed', { cause: error });
    }
  }

  async decrypt(keyName: string, ciphertext: string): Promise<DecryptionResult> {
    try {
      const [encryptedDataB64, ivB64] = ciphertext.split('.');

      if (!encryptedDataB64 || !ivB64) {
        throw new Error('Invalid ciphertext format');
      }

      const encryptedData = Buffer.from(encryptedDataB64, 'base64');
      const iv = Buffer.from(ivB64, 'base64');

      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        Buffer.from(this.encryptionKey, 'hex'),
        'AES-GCM',
        false,
        ['decrypt'],
      );

      const decrypted = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv,
        },
        cryptoKey,
        encryptedData,
      );

      const decryptedStr = Buffer.from(decrypted).toString('utf-8');

      const [decryptedKeyName, plaintext] = decryptedStr.split('.');

      if (decryptedKeyName !== keyName) {
        throw new Error('Decryption key mismatch');
      }

      return {
        plaintext,
        keyId: decryptedKeyName,
      };
    } catch (error) {
      throw new CryptographyServiceError('Decryption failed', {
        cause: error,
      });
    }
  }
}
