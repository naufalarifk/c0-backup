import {
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import * as vault from 'node-vault';

import {
  DatabaseCredentials,
  DecryptionResult,
  EncryptionResult,
  VaultAuth,
  VaultHealthStatus,
} from './vault.dto';

@Injectable()
export class VaultService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VaultService.name);

  private vaultClient: vault.client;
  private tokenRenewalTimer: NodeJS.Timeout;
  private isInitialized = false;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    await this.initializeVault();
  }

  private async initializeVault() {
    try {
      const vaultAddr = this.configService.get<string>('VAULT_ADDR') || 'http://127.0.0.1:8200';
      const vaultToken = this.configService.get<string>('VAULT_TOKEN');

      this.logger.log(`Initializing Vault client with endpoint: ${vaultAddr}`);

      this.vaultClient = vault.default({
        apiVersion: 'v1',
        endpoint: vaultAddr,
        token: vaultToken,
        requestOptions: {
          timeout: 10000, // 10 second timeout
        },
      });

      // Test connection
      await this.healthCheck();

      // Authenticate using AppRole if no token provided
      if (!vaultToken) {
        await this.authenticateWithAppRole();
      } else {
        // Verify token is valid
        await this.verifyToken();
      }

      // Start token renewal
      this.startTokenRenewal();

      this.isInitialized = true;
      this.logger.log('Vault client initialized successfully');
    } catch (error) {
      this.logger.warn(`Failed to initialize Vault client: ${error.message}`);
      this.logger.warn('Vault integration disabled - some features may not be available');
      this.isInitialized = false;
      throw new Error(`Vault initialization failed: ${error.message}`);
    }
  }

  private async verifyToken(): Promise<void> {
    try {
      const tokenInfo = await this.vaultClient.tokenLookupSelf();
      this.logger.log(`Token verified successfully. TTL: ${tokenInfo.data.ttl}s`);
    } catch (error) {
      this.logger.error('Token verification failed', error.message);
      throw error;
    }
  }

  private async authenticateWithAppRole(): Promise<void> {
    const roleId = this.configService.get<string>('VAULT_ROLE_ID');
    const secretId = this.configService.get<string>('VAULT_SECRET_ID');

    if (!roleId || !secretId) {
      throw new Error('VAULT_ROLE_ID and VAULT_SECRET_ID must be provided when no token is set');
    }

    try {
      this.logger.log('Authenticating with AppRole...');
      const result = await this.vaultClient.approleLogin({
        role_id: roleId,
        secret_id: secretId,
      });

      this.vaultClient.token = result.auth.client_token;
      this.logger.log('Successfully authenticated with AppRole');
      return result;
    } catch (error) {
      this.logger.error('AppRole authentication failed', error.message);
      throw new HttpException(
        `AppRole authentication failed: ${error.message}`,
        HttpStatus.UNAUTHORIZED,
      );
    }
  }

  private startTokenRenewal(): void {
    // Renew token every 30 minutes
    this.tokenRenewalTimer = setInterval(
      () => {
        this.renewToken().catch(error => {
          this.logger.error('Error during token renewal', error.message);
          // Try to re-authenticate if token renewal fails
          this.authenticateWithAppRole().catch(authError => {
            this.logger.error(
              'Failed to re-authenticate after token renewal failure',
              authError.message,
            );
          });
        });
      },
      30 * 60 * 1000,
    ); // 30 minutes
  }

  private async renewToken(): Promise<void> {
    try {
      const result = await this.vaultClient.tokenRenewSelf();
      this.logger.log(`Token renewed successfully. New TTL: ${result.auth.lease_duration}s`);
    } catch (error) {
      this.logger.error('Token renewal failed', error.message);
      throw error;
    }
  }

  async healthCheck(): Promise<VaultHealthStatus> {
    const health = await this.vaultClient.health();

    try {
      this.logger.debug('Vault health check successful');
      return health;
    } catch (error) {
      this.logger.error('Vault health check failed', error.message);

      throw new HttpException(
        `Vault health check failed: ${error.message}`,
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const health = await this.healthCheck();
      return health.initialized && !health.sealed;
    } catch {
      return false;
    }
  }

  // KV v1 Secret Operations
  async getSecret(path: string) {
    this.ensureInitialized();
    try {
      this.logger.debug(`Reading secret from path: ${path}`);
      const response = await this.vaultClient.read(path);
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to read secret from path: ${path}`, error.message);
      throw new HttpException(`Failed to read secret: ${error.message}`, HttpStatus.NOT_FOUND);
    }
  }

  // KV v2 Secret Operations
  async getKv2Secret(path: string) {
    this.ensureInitialized();
    try {
      this.logger.debug(`Reading KV2 secret from path: secret/data/${path}`);
      const response = await this.vaultClient.read(`secret/data/${path}`);
      return response.data.data;
    } catch (error) {
      this.logger.error(`Failed to read KV2 secret from path: ${path}`, error.message);
      throw new HttpException(`Failed to read KV2 secret: ${error.message}`, HttpStatus.NOT_FOUND);
    }
  }

  async writeSecret(path: string, data: Record<string, string>): Promise<void> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Writing secret to path: ${path}`);
      await this.vaultClient.write(path, data);
      this.logger.log(`Secret written successfully to path: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to write secret to path: ${path}`, error.message);
      throw new HttpException(
        `Failed to write secret: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async writeKv2Secret(path: string, data: Record<string, string>): Promise<void> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Writing KV2 secret to path: secret/data/${path}`);
      await this.vaultClient.write(`secret/data/${path}`, { data });
      this.logger.log(`KV2 secret written successfully to path: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to write KV2 secret to path: ${path}`, error.message);
      throw new HttpException(
        `Failed to write KV2 secret: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async deleteSecret(path: string): Promise<void> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Deleting secret from path: ${path}`);
      await this.vaultClient.delete(path);
      this.logger.log(`Secret deleted successfully from path: ${path}`);
    } catch (error) {
      this.logger.error(`Failed to delete secret from path: ${path}`, error.message);
      throw new HttpException(
        `Failed to delete secret: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Database Dynamic Secrets
  async getDatabaseCredentials(role: string): Promise<DatabaseCredentials> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Getting database credentials for role: ${role}`);
      const response = await this.vaultClient.read(`database/creds/${role}`);

      const credentials: DatabaseCredentials = {
        username: response.data.username,
        password: response.data.password,
        lease_id: response.lease_id,
        lease_duration: response.lease_duration,
        renewable: response.renewable,
      };

      this.logger.log(`Database credentials generated successfully for role: ${role}`);
      return credentials;
    } catch (error) {
      this.logger.error(`Failed to get database credentials for role: ${role}`, error.message);
      throw new HttpException(
        `Failed to get database credentials: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Transit Encryption
  async createTransitKey(keyName: string, keyType: string = 'aes256-gcm96'): Promise<void> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Creating transit key: ${keyName} of type: ${keyType}`);
      await this.vaultClient.write(`transit/keys/${keyName}`, {
        type: keyType,
        exportable: false,
      });
      this.logger.log(`Transit key created successfully: ${keyName}`);
    } catch (error) {
      this.logger.error(`Failed to create transit key: ${keyName}`, error.message);
      throw new HttpException(
        `Failed to create transit key: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async encryptData(
    keyName: string,
    plaintext: string,
    context?: string,
  ): Promise<EncryptionResult> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Encrypting data with key: ${keyName}`);

      const base64Data = Buffer.from(plaintext, 'utf8').toString('base64');
      const payload: Record<string, string> = { plaintext: base64Data };

      if (context) {
        payload.context = Buffer.from(context, 'utf8').toString('base64');
      }

      const response = await this.vaultClient.write(`transit/encrypt/${keyName}`, payload);

      this.logger.log('Data encrypted successfully');
      return { ciphertext: response.data.ciphertext };
    } catch (error) {
      this.logger.error(`Failed to encrypt data with key: ${keyName}`, error.message);
      throw new HttpException(
        `Failed to encrypt data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async decryptData(
    keyName: string,
    ciphertext: string,
    context?: string,
  ): Promise<DecryptionResult> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Decrypting data with key: ${keyName}`);

      const payload: Record<string, string> = { ciphertext };

      if (context) {
        payload.context = Buffer.from(context, 'utf8').toString('base64');
      }

      const response = await this.vaultClient.write(`transit/decrypt/${keyName}`, payload);

      const plaintext = Buffer.from(response.data.plaintext, 'base64').toString('utf8');

      this.logger.log('Data decrypted successfully');
      return { plaintext };
    } catch (error) {
      this.logger.error(`Failed to decrypt data with key: ${keyName}`, error.message);
      throw new HttpException(
        `Failed to decrypt data: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Policy Management
  async createPolicy(name: string, policy: string): Promise<void> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Creating policy: ${name}`);
      await this.vaultClient.addPolicy({
        name,
        rules: policy,
      });
      this.logger.log(`Policy created successfully: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to create policy: ${name}`, error.message);
      throw new HttpException(
        `Failed to create policy: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getPolicy(name: string): Promise<string> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Getting policy: ${name}`);
      const response = await this.vaultClient.getPolicy({ name });
      return response.rules || response;
    } catch (error) {
      this.logger.error(`Failed to get policy: ${name}`, error.message);
      throw new HttpException(`Failed to get policy: ${error.message}`, HttpStatus.NOT_FOUND);
    }
  }

  async deletePolicy(name: string): Promise<void> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Deleting policy: ${name}`);
      await this.vaultClient.removePolicy({ name });
      this.logger.log(`Policy deleted successfully: ${name}`);
    } catch (error) {
      this.logger.error(`Failed to delete policy: ${name}`, error.message);
      throw new HttpException(
        `Failed to delete policy: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Token Management
  async createToken(policies: string[] = [], ttl: string = '1h'): Promise<VaultAuth> {
    this.ensureInitialized();
    try {
      this.logger.debug(`Creating token with policies: ${policies.join(', ')}, TTL: ${ttl}`);
      const response = await this.vaultClient.tokenCreate({
        policies,
        ttl,
        renewable: true,
      });

      this.logger.log('Token created successfully');
      return response.auth;
    } catch (error) {
      this.logger.error('Failed to create token', error.message);
      throw new HttpException(
        `Failed to create token: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async revokeToken(token: string): Promise<void> {
    this.ensureInitialized();
    try {
      this.logger.debug('Revoking token');
      await this.vaultClient.tokenRevoke({ token });
      this.logger.log('Token revoked successfully');
    } catch (error) {
      this.logger.error('Failed to revoke token', error.message);
      throw new HttpException(
        `Failed to revoke token: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new HttpException(
        'Vault service not initialized. Please check Vault configuration and ensure Vault server is running.',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  onModuleDestroy() {
    if (this.tokenRenewalTimer) {
      clearInterval(this.tokenRenewalTimer);
      this.logger.log('Token renewal timer cleared');
    }
  }
}
