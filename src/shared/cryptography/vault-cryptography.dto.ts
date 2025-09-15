import { Transform } from 'class-transformer';
import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class AppRoleLoginDto {
  @IsNotEmpty({ message: 'Role ID is required' })
  @IsString({ message: 'Role ID must be a string' })
  role_id: string;

  @IsNotEmpty({ message: 'Secret ID is required' })
  @IsString({ message: 'Secret ID must be a string' })
  secret_id: string;
}

export class SecretPathDto {
  @IsNotEmpty({ message: 'Path is required' })
  @IsString({ message: 'Path must be a string' })
  @Transform(({ value }) => value?.trim())
  path: string;
}

export class WriteSecretDto {
  @IsNotEmpty({ message: 'Path is required' })
  @IsString({ message: 'Path must be a string' })
  @Transform(({ value }) => value?.trim())
  path: string;

  @IsNotEmpty({ message: 'Data is required' })
  @IsObject({ message: 'Data must be an object' })
  data: Record<string, unknown>;
}

export class EncryptDataDto {
  @IsNotEmpty({ message: 'Data is required' })
  @IsString({ message: 'Data must be a string' })
  data: string;

  @IsOptional()
  @IsString({ message: 'Context must be a string' })
  context?: string;
}

export class DecryptDataDto {
  @IsNotEmpty({ message: 'Ciphertext is required' })
  @IsString({ message: 'Ciphertext must be a string' })
  ciphertext: string;

  @IsOptional()
  @IsString({ message: 'Context must be a string' })
  context?: string;
}

export class DatabaseCredentialsDto {
  @IsNotEmpty({ message: 'Role is required' })
  @IsString({ message: 'Role must be a string' })
  @Transform(({ value }) => value?.trim())
  role: string;
}

export class TransitKeyDto {
  @IsNotEmpty({ message: 'Key name is required' })
  @IsString({ message: 'Key name must be a string' })
  @Transform(({ value }) => value?.trim())
  keyName: string;

  @IsOptional()
  @IsString({ message: 'Key type must be a string' })
  keyType?: string;
}

export class CreatePolicyDto {
  @IsNotEmpty({ message: 'Policy name is required' })
  @IsString({ message: 'Policy name must be a string' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @IsNotEmpty({ message: 'Policy rules are required' })
  @IsString({ message: 'Policy rules must be a string' })
  policy: string;
}

// Response Types
export class VaultAuth {
  client_token: string;
  accessor: string;
  policies: string[];
  token_policies: string[];
  metadata: Record<string, unknown>;
  lease_duration: number;
  renewable: boolean;
  entity_id: string;
  token_type: string;
  orphan: boolean;
  mfa_requirement: unknown;
  num_uses: number;
}

export class VaultResponse<T = unknown> {
  request_id: string;
  lease_id: string;
  renewable: boolean;
  lease_duration: number;
  data: T;
  wrap_info: unknown;
  warnings: unknown;
  auth?: VaultAuth;
}

export class VaultErrorResponse {
  errors: string[];
}

export class DatabaseCredentials {
  username: string;
  password: string;
  lease_id: string;
  lease_duration: number;
  renewable: boolean;
}

export class VaultHealthStatus {
  initialized: boolean;
  sealed: boolean;
  standby: boolean;
  performance_standby: boolean;
  replication_performance_mode: string;
  replication_dr_mode: string;
  server_time_utc: number;
  version: string;
  cluster_name: string;
  cluster_id: string;
}
