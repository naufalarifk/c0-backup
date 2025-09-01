import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';

export class GenerateWalletDto {
  @ApiProperty({
    description: 'Blockchain key/index for address derivation',
    example: '0',
  })
  @IsNotEmpty({ message: 'Blockchain key is required' })
  @IsString({ message: 'Blockchain key must be a string' })
  @Transform(({ value }) => value?.trim())
  blockchainKey: string;

  @ApiPropertyOptional({
    description: 'Network type',
    example: 'testnet',
    enum: ['mainnet', 'testnet'],
    default: 'testnet',
  })
  @IsOptional()
  @IsString({ message: 'Network must be a string' })
  network?: 'mainnet' | 'testnet';
}

export class MultiChainWalletResponseDto {
  @ApiProperty({
    description: 'Generated addresses for different blockchains',
    example: {
      btc: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
      eth: '0x742d35Cc6aB1C0532F4c7D7B8b1F6B7E0C7b8A8B',
      solana: '11111111111111111111111111111112',
    },
  })
  addresses: {
    btc: string;
    eth: string;
    solana: string;
  };

  @ApiProperty({
    description: 'Public keys for different blockchains',
    example: {
      btc: '03ad1d8e89212f0b92c74d23bb710c00662451716a435b97381e8d11f67362a853',
      eth: '0x04ad1d8e89212f0b92c74d23bb710c00662451716a435b97381e8d11f67362a853',
      solana: '11111111111111111111111111111112',
    },
  })
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

  @ApiProperty({
    description: 'Derivation paths used for each blockchain',
    example: {
      btc: "m/44'/0'/0'/0/0",
      eth: "m/44'/60'/0'/0/0",
      solana: "m/44'/501'/0'/0/0",
    },
  })
  derivationPaths: {
    btc: string;
    eth: string;
    solana: string;
  };

  @ApiProperty({
    description: 'Wallet generation timestamp',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  createdAt: string;
}

export class RestoreWalletDto {
  @ApiProperty({
    description: 'BIP39 mnemonic phrase (12 or 24 words)',
    example:
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
    minLength: 23,
  })
  @IsNotEmpty({ message: 'Mnemonic is required' })
  @IsString({ message: 'Mnemonic must be a string' })
  @Transform(({ value }) => value?.trim())
  mnemonic: string;

  @ApiProperty({
    description: 'Name for the restored wallet',
    example: 'Restored Wallet',
    minLength: 1,
  })
  @IsNotEmpty({ message: 'Wallet name is required' })
  @IsString({ message: 'Wallet name must be a string' })
  @MinLength(1, { message: 'Wallet name must not be empty' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Optional BIP39 passphrase that was used with the original mnemonic',
    example: 'original-passphrase',
  })
  @IsOptional()
  @IsString({ message: 'Passphrase must be a string' })
  passphrase?: string;
}

export class CreateAccountDto {
  @ApiProperty({
    description: 'BIP44 account index (must be unique within the wallet)',
    example: 0,
    minimum: 0,
  })
  @IsNotEmpty({ message: 'Account index is required' })
  @IsNumber({}, { message: 'Account index must be a number' })
  @Type(() => Number)
  @Min(0, { message: 'Account index must be non-negative' })
  accountIndex: number;

  @ApiPropertyOptional({
    description: 'Human-readable name for the account',
    example: 'Main Account',
  })
  @IsOptional()
  @IsString({ message: 'Account name must be a string' })
  @Transform(({ value }) => value?.trim())
  name?: string;
}

export class GenerateAddressDto {
  @ApiPropertyOptional({
    description: 'Whether this is a change address (true) or receiving address (false)',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean({ message: 'isChange must be a boolean' })
  @Type(() => Boolean)
  isChange?: boolean;

  @ApiPropertyOptional({
    description: 'BIP44 address index within the account',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Address index must be a number' })
  @Type(() => Number)
  @Min(0, { message: 'Address index must be non-negative' })
  addressIndex?: number;
}

export class SignBitcoinTransactionDto {
  @ApiProperty({
    description: 'Transaction inputs',
    example: [
      {
        txid: 'a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab',
        vout: 0,
        value: 100000000,
        scriptPubKey: '76a914...',
      },
    ],
  })
  @IsNotEmpty({ message: 'Transaction inputs are required' })
  @IsObject({ each: true, message: 'Each input must be an object' })
  inputs: Array<{
    txid: string;
    vout: number;
    value: number;
    scriptPubKey: string;
  }>;

  @ApiProperty({
    description: 'Transaction outputs',
    example: [
      {
        address: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
        value: 50000000,
      },
    ],
  })
  @IsNotEmpty({ message: 'Transaction outputs are required' })
  @IsObject({ each: true, message: 'Each output must be an object' })
  outputs: Array<{
    address: string;
    value: number;
  }>;

  @ApiProperty({
    description: 'Private key for signing (hex format)',
    example: 'L1aW4aubDFB7yfras2S1mN3bqg9nwySY8nkoLmJebSLD5BWv3ENZ',
  })
  @IsNotEmpty({ message: 'Private key is required' })
  @IsString({ message: 'Private key must be a string' })
  privateKey: string;

  @ApiPropertyOptional({
    description: 'Fee rate in satoshis per byte',
    example: 10,
    default: 10,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Fee rate must be a number' })
  @Type(() => Number)
  @Min(1, { message: 'Fee rate must be at least 1' })
  feeRate?: number;
}

export class SignEthereumTransactionDto {
  @ApiProperty({
    description: 'Recipient address',
    example: '0x742d35Cc6aB1C0532F4c7D7B8b1F6B7E0C7b8A8B',
  })
  @IsNotEmpty({ message: 'To address is required' })
  @IsString({ message: 'To address must be a string' })
  to: string;

  @ApiProperty({
    description: 'Amount to send in wei',
    example: '1000000000000000000',
  })
  @IsNotEmpty({ message: 'Value is required' })
  @IsString({ message: 'Value must be a string' })
  value: string;

  @ApiProperty({
    description: 'Private key for signing (hex format without 0x prefix)',
    example: 'ac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
  })
  @IsNotEmpty({ message: 'Private key is required' })
  @IsString({ message: 'Private key must be a string' })
  privateKey: string;

  @ApiPropertyOptional({
    description: 'Gas limit',
    example: 21000,
    default: 21000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Gas limit must be a number' })
  @Type(() => Number)
  @Min(21000, { message: 'Gas limit must be at least 21000' })
  gasLimit?: number;

  @ApiPropertyOptional({
    description: 'Gas price in wei',
    example: '20000000000',
  })
  @IsOptional()
  @IsString({ message: 'Gas price must be a string' })
  gasPrice?: string;

  @ApiPropertyOptional({
    description: 'Transaction data (for contract calls)',
    example: '0x',
  })
  @IsOptional()
  @IsString({ message: 'Data must be a string' })
  data?: string;
}

export class SignSolanaTransactionDto {
  @ApiProperty({
    description: 'Recipient public key',
    example: '11111111111111111111111111111112',
  })
  @IsNotEmpty({ message: 'To address is required' })
  @IsString({ message: 'To address must be a string' })
  to: string;

  @ApiProperty({
    description: 'Amount to send in lamports',
    example: 1000000000,
  })
  @IsNotEmpty({ message: 'Amount is required' })
  @IsNumber({}, { message: 'Amount must be a number' })
  @Type(() => Number)
  @Min(1, { message: 'Amount must be at least 1 lamport' })
  amount: number;

  @ApiProperty({
    description: 'Private key for signing (base58 format)',
    example: '5Hpn6bcbzkjYHC6YJ8JZhP3CpjCUKyT5JYk8zjCzNd9F',
  })
  @IsNotEmpty({ message: 'Private key is required' })
  @IsString({ message: 'Private key must be a string' })
  privateKey: string;

  @ApiPropertyOptional({
    description: 'Memo for the transaction',
    example: 'Payment for services',
  })
  @IsOptional()
  @IsString({ message: 'Memo must be a string' })
  memo?: string;
}

// Response DTOs
export class HealthResponseDto {
  @ApiProperty({
    description: 'Health status of the service',
    example: 'ok',
  })
  status: string;

  @ApiProperty({
    description: 'Detailed health message',
    example: 'Wallet service is healthy',
  })
  message: string;

  @ApiProperty({
    description: 'Timestamp of health check',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  timestamp: string;
}

export class WalletResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the created wallet',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Name of the wallet',
    example: 'My Bitcoin Wallet',
  })
  name: string;

  @ApiProperty({
    description: 'Master public key (xpub) of the wallet',
    example:
      'xpub6CUGRUonZSQ4TVXXQrFNh9JoRuaxtjh8yJCFLJhEVZKFx2pHKNXnP4DH3Yj7MnHRSHV5W6o9C4NkPYFwNH1Vz7t8s2p1q3m4n5k6j7h8',
  })
  masterPublicKey: string;

  @ApiProperty({
    description: 'Derivation path used for this wallet',
    example: "m/44'/0'/0'",
  })
  derivationPath: string;

  @ApiProperty({
    description: 'Network type (mainnet, testnet)',
    example: 'mainnet',
  })
  network: string;

  @ApiProperty({
    description: 'Wallet creation timestamp',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Indicates if mnemonic is encrypted in Vault',
    example: true,
  })
  isEncrypted: boolean;
}

export class AccountResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the created account',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Wallet ID this account belongs to',
    example: 1,
  })
  walletId: number;

  @ApiProperty({
    description: 'BIP44 account index',
    example: 0,
  })
  accountIndex: number;

  @ApiProperty({
    description: 'Account name',
    example: 'Main Account',
  })
  name: string;

  @ApiProperty({
    description: 'Extended public key for this account',
    example: 'xpub6FnCn6nSzZAw5Tv7vX8F2JrKNXnP4DH3Yj7MnHRSHV5W6o9C4NkPYFwNH1Vz7t8s2p1q3m4n5k6j7h8',
  })
  extendedPublicKey: string;

  @ApiProperty({
    description: 'BIP44 derivation path for this account',
    example: "m/44'/0'/0'",
  })
  derivationPath: string;

  @ApiProperty({
    description: 'Account creation timestamp',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  createdAt: string;
}

export class AddressResponseDto {
  @ApiProperty({
    description: 'Unique identifier of the generated address',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: 'Account ID this address belongs to',
    example: 1,
  })
  accountId: number;

  @ApiProperty({
    description: 'Generated Bitcoin address',
    example: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2',
  })
  address: string;

  @ApiProperty({
    description: 'Public key associated with this address',
    example: '03ad1d8e89212f0b92c74d23bb710c00662451716a435b97381e8d11f67362a853',
  })
  publicKey: string;

  @ApiProperty({
    description: 'Whether this is a change address',
    example: false,
  })
  isChange: boolean;

  @ApiProperty({
    description: 'Address index within the account',
    example: 0,
  })
  addressIndex: number;

  @ApiProperty({
    description: 'Full BIP44 derivation path for this address',
    example: "m/44'/0'/0'/0/0",
  })
  derivationPath: string;

  @ApiProperty({
    description: 'Address creation timestamp',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  createdAt: string;
}

export class BalanceResponseDto {
  @ApiProperty({
    description: 'Wallet ID',
    example: 1,
  })
  walletId: number;

  @ApiProperty({
    description: 'Total confirmed balance in satoshis',
    example: 100000000,
  })
  confirmedBalance: number;

  @ApiProperty({
    description: 'Total unconfirmed balance in satoshis',
    example: 50000000,
  })
  unconfirmedBalance: number;

  @ApiProperty({
    description: 'Total balance in satoshis (confirmed + unconfirmed)',
    example: 150000000,
  })
  totalBalance: number;

  @ApiProperty({
    description: 'Total balance in BTC',
    example: 1.5,
  })
  totalBalanceBtc: number;

  @ApiProperty({
    description: 'Number of addresses with balance',
    example: 3,
  })
  addressCount: number;

  @ApiProperty({
    description: 'Last balance update timestamp',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  lastUpdated: string;
}

export class BitcoinSignatureResponseDto {
  @ApiProperty({
    description: 'Signed transaction in hexadecimal format',
    example: '0100000001a1b2c3d4e5f6789abcdef...',
  })
  signedTransaction: string;

  @ApiProperty({
    description: 'Transaction hash (TXID)',
    example: 'a1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab',
  })
  transactionHash: string;

  @ApiProperty({
    description: 'Size of the signed transaction in bytes',
    example: 250,
  })
  transactionSize: number;

  @ApiProperty({
    description: 'Transaction fee in satoshis',
    example: 2500,
  })
  transactionFee: number;

  @ApiProperty({
    description: 'Transaction signing timestamp',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  signedAt: string;
}

export class EthereumSignatureResponseDto {
  @ApiProperty({
    description: 'Signed transaction hash',
    example: '0xa1b2c3d4e5f6789abcdef1234567890abcdef1234567890abcdef1234567890ab',
  })
  transactionHash: string;

  @ApiProperty({
    description: 'Serialized signed transaction',
    example: '0x02f87...',
  })
  signedTransaction: string;

  @ApiProperty({
    description: 'Gas used for the transaction',
    example: 21000,
  })
  gasUsed: number;

  @ApiProperty({
    description: 'Gas price in wei',
    example: '20000000000',
  })
  gasPrice: string;

  @ApiProperty({
    description: 'Transaction nonce',
    example: 42,
  })
  nonce: number;

  @ApiProperty({
    description: 'Transaction signing timestamp',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  signedAt: string;
}

export class SolanaSignatureResponseDto {
  @ApiProperty({
    description: 'Transaction signature',
    example: '3Bxs4h5Y6T8jVFd...signature...',
  })
  signature: string;

  @ApiProperty({
    description: 'Recent blockhash used',
    example: 'GHtXQBsoZHVnP6u...blockhash...',
  })
  recentBlockhash: string;

  @ApiProperty({
    description: 'Transaction fee in lamports',
    example: 5000,
  })
  transactionFee: number;

  @ApiProperty({
    description: 'Transaction signing timestamp',
    example: '2023-01-01T12:00:00.000Z',
    format: 'date-time',
  })
  signedAt: string;
}
