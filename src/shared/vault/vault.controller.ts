import { 
  Controller, 
  Post, 
  Get, 
  Delete,
  Body, 
  Param, 
  Logger,
  UseFilters
} from '@nestjs/common';
import { VaultService } from './vault.service';
import { VaultExceptionFilter } from './vault-exception.filter';
import { 
  WriteSecretDto, 
  EncryptDataDto, 
  DecryptDataDto, 
  DatabaseCredentialsDto, 
  TransitKeyDto, 
  CreatePolicyDto,
  VaultAuth,
  DatabaseCredentials,
  EncryptionResult,
  DecryptionResult,
  VaultHealthStatus
} from './vault.dto';

@Controller('vault')
@UseFilters(VaultExceptionFilter)
export class VaultController {
  private readonly logger = new Logger(VaultController.name);
  
  constructor(private readonly vaultService: VaultService) {}

  @Get('health')
  async getHealth(): Promise<VaultHealthStatus> {
    this.logger.log('Checking Vault health status');
    try {
      return await this.vaultService.healthCheck();
    } catch (error: any) {
      this.logger.error('Health check failed', error.message);
      throw error;
    }
  }

  @Get('status')
  async getStatus(): Promise<{ healthy: boolean; message: string }> {
    this.logger.log('Checking Vault service status');
    try {
      const isHealthy = await this.vaultService.isHealthy();
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Vault is healthy and accessible' : 'Vault is not accessible'
      };
    } catch (error: any) {
      this.logger.error('Status check failed', error.message);
      return {
        healthy: false,
        message: `Vault status check failed: ${error.message}`
      };
    }
  }

  // Secret Management (KV v1)
  @Get('secret/:path')
  async getSecret(@Param('path') path: string): Promise<any> {
    this.logger.log(`Getting secret from path: ${path}`);
    return await this.vaultService.getSecret(path);
  }

  @Post('secret/write')
  async writeSecret(@Body() writeSecretDto: WriteSecretDto): Promise<{ message: string }> {
    const { path, data } = writeSecretDto;
    this.logger.log(`Writing secret to path: ${path}`);
    await this.vaultService.writeSecret(path, data);
    return { message: `Secret written successfully to ${path}` };
  }

  @Delete('secret/:path')
  async deleteSecret(@Param('path') path: string): Promise<{ message: string }> {
    this.logger.log(`Deleting secret from path: ${path}`);
    await this.vaultService.deleteSecret(path);
    return { message: `Secret deleted successfully from ${path}` };
  }

  // KV v2 Operations
  @Get('kv2/:path')
  async getKv2Secret(@Param('path') path: string): Promise<any> {
    this.logger.log(`Getting KV2 secret from path: ${path}`);
    return await this.vaultService.getKv2Secret(path);
  }

  @Post('kv2/write')
  async writeKv2Secret(@Body() writeSecretDto: WriteSecretDto): Promise<{ message: string }> {
    const { path, data } = writeSecretDto;
    this.logger.log(`Writing KV2 secret to path: ${path}`);
    await this.vaultService.writeKv2Secret(path, data);
    return { message: `KV2 secret written successfully to ${path}` };
  }

  // Database Dynamic Secrets
  @Post('database/credentials')
  async getDatabaseCredentials(@Body() dto: DatabaseCredentialsDto): Promise<DatabaseCredentials> {
    const { role } = dto;
    this.logger.log(`Getting database credentials for role: ${role}`);
    return await this.vaultService.getDatabaseCredentials(role);
  }

  // Transit Encryption
  @Post('transit/key')
  async createTransitKey(@Body() dto: TransitKeyDto): Promise<{ message: string }> {
    const { keyName, keyType } = dto;
    this.logger.log(`Creating transit key: ${keyName}`);
    await this.vaultService.createTransitKey(keyName, keyType);
    return { message: `Transit key ${keyName} created successfully` };
  }

  @Post('transit/encrypt/:keyName')
  async encryptData(
    @Param('keyName') keyName: string,
    @Body() dto: EncryptDataDto
  ): Promise<EncryptionResult> {
    const { data, context } = dto;
    this.logger.log(`Encrypting data with key: ${keyName}`);
    return await this.vaultService.encryptData(keyName, data, context);
  }

  @Post('transit/decrypt/:keyName')
  async decryptData(
    @Param('keyName') keyName: string,
    @Body() dto: DecryptDataDto
  ): Promise<DecryptionResult> {
    const { ciphertext, context } = dto;
    this.logger.log(`Decrypting data with key: ${keyName}`);
    return await this.vaultService.decryptData(keyName, ciphertext, context);
  }

  // Policy Management
  @Post('policy')
  async createPolicy(@Body() dto: CreatePolicyDto): Promise<{ message: string }> {
    const { name, policy } = dto;
    this.logger.log(`Creating policy: ${name}`);
    await this.vaultService.createPolicy(name, policy);
    return { message: `Policy ${name} created successfully` };
  }

  @Get('policy/:name')
  async getPolicy(@Param('name') name: string): Promise<{ name: string; policy: string }> {
    this.logger.log(`Getting policy: ${name}`);
    const policy = await this.vaultService.getPolicy(name);
    return { name, policy };
  }

  @Delete('policy/:name')
  async deletePolicy(@Param('name') name: string): Promise<{ message: string }> {
    this.logger.log(`Deleting policy: ${name}`);
    await this.vaultService.deletePolicy(name);
    return { message: `Policy ${name} deleted successfully` };
  }

  // Token Management
  @Post('token/create')
  async createToken(@Body() body: { policies?: string[]; ttl?: string }): Promise<VaultAuth> {
    const { policies = [], ttl = '1h' } = body;
    this.logger.log(`Creating token with policies: [${policies.join(', ')}], TTL: ${ttl}`);
    return await this.vaultService.createToken(policies, ttl);
  }

  @Post('token/revoke')
  async revokeToken(@Body() body: { token: string }): Promise<{ message: string }> {
    const { token } = body;
    this.logger.log('Revoking token');
    await this.vaultService.revokeToken(token);
    return { message: 'Token revoked successfully' };
  }

  // Wallet Integration Examples
  @Post('wallet/encrypt-mnemonic')
  async encryptMnemonic(@Body() body: { mnemonic: string; walletId: string }): Promise<EncryptionResult> {
    const { mnemonic, walletId } = body;
    this.logger.log(`Encrypting mnemonic for wallet: ${walletId}`);
    
    // Create a unique encryption key for the wallet if it doesn't exist
    const keyName = `wallet-${walletId}`;
    try {
      await this.vaultService.createTransitKey(keyName);
      this.logger.log(`Created new transit key for wallet: ${keyName}`);
    } catch (error: any) {
      // Key might already exist, which is fine
      if (!error.message.includes('path is already in use')) {
        throw error;
      }
    }
    
    return await this.vaultService.encryptData(keyName, mnemonic, walletId);
  }

  @Post('wallet/decrypt-mnemonic')
  async decryptMnemonic(@Body() body: { ciphertext: string; walletId: string }): Promise<DecryptionResult> {
    const { ciphertext, walletId } = body;
    this.logger.log(`Decrypting mnemonic for wallet: ${walletId}`);
    
    const keyName = `wallet-${walletId}`;
    return await this.vaultService.decryptData(keyName, ciphertext, walletId);
  }

  @Post('wallet/store-config')
  async storeWalletConfig(@Body() body: { walletId: string; config: any }): Promise<{ message: string }> {
    const { walletId, config } = body;
    this.logger.log(`Storing configuration for wallet: ${walletId}`);
    
    const path = `wallets/${walletId}/config`;
    await this.vaultService.writeKv2Secret(path, config);
    return { message: `Wallet configuration stored successfully for ${walletId}` };
  }

  @Get('wallet/:walletId/config')
  async getWalletConfig(@Param('walletId') walletId: string): Promise<any> {
    this.logger.log(`Getting configuration for wallet: ${walletId}`);
    
    const path = `wallets/${walletId}/config`;
    return await this.vaultService.getKv2Secret(path);
  }
}