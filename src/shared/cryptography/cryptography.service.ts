import { Injectable } from '@nestjs/common';

import { DecryptionResult, EncryptionResult } from './vault.dto';

@Injectable()
export abstract class CryptographyService {
  abstract getSecret(path: string): Promise<unknown>;

  // biome-ignore lint/suspicious/noExplicitAny: Using any for dynamic secret data
  abstract writeSecret(path: string, data: Record<string, any>): Promise<void>;

  abstract deleteSecret(path: string): Promise<void>;

  abstract encrypt(keyName: string, plaintext: string): Promise<EncryptionResult>;

  abstract decrypt(keyName: string, ciphertext: string): Promise<DecryptionResult>;
}
