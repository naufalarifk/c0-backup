import { ApiProperty } from '@nestjs/swagger';

import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';

import { IsValidBlockchainAddress } from './validators/blockchain-address.validator';

export class CreateBeneficiaryDto {
  @ApiProperty({
    description: 'Blockchain network identifier using CAIP-2 format',
    examples: {
      ethereum: {
        summary: 'Ethereum Mainnet',
        value: 'eip155:1',
      },
      bsc: {
        summary: 'Binance Smart Chain',
        value: 'eip155:56',
      },
      bitcoin: {
        summary: 'Bitcoin Mainnet',
        value: 'bip122:000000000019d6689c085ae165831e93',
      },
      solana: {
        summary: 'Solana Mainnet',
        value: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
      crosschain: {
        summary: 'Cross-Chain',
        value: 'crosschain',
      },
    },
  })
  @IsString({ message: 'Blockchain key must be a string' })
  @IsNotEmpty({ message: 'Blockchain key is required' })
  @Matches(/^(crosschain|[a-z0-9]{3,8}:[a-zA-Z0-9_-]{1,64})$/, {
    message:
      'Blockchain key must be valid format: CAIP-2 (e.g., eip155:1, bip122:000000000019d6689c085ae165831e93, solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp) or "crosschain"',
  })
  @Transform(({ value }) => value?.trim())
  blockchainKey: string;

  @ApiProperty({
    description: 'Token identifier using appropriate standard based on blockchain',
    examples: {
      erc20: {
        summary: 'ERC-20 Token (Ethereum/EVM)',
        value: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      },
      spl: {
        summary: 'SPL Token (Solana)',
        value: 'spl:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      },
      native_eth: {
        summary: 'Native ETH',
        value: 'native',
      },
      native_btc: {
        summary: 'Native Bitcoin',
        value: 'native',
      },
      bep20: {
        summary: 'BEP-20 Token (BSC)',
        value: 'bep20:0x55d398326f99059ff775485246999027b3197955',
      },
    },
  })
  @IsString({ message: 'Token ID must be a string' })
  @IsNotEmpty({ message: 'Token ID is required' })
  @Matches(
    /^(erc20:0x[a-fA-F0-9]{40}|bep20:0x[a-fA-F0-9]{40}|spl:[a-zA-Z0-9]{32,44}|brc20:[a-zA-Z0-9]+|native)$/,
    {
      message:
        'Token ID must be valid format (erc20:0x..., bep20:0x..., spl:..., brc20:..., or native)',
    },
  )
  @Transform(({ value }) => value?.trim())
  tokenId: string;

  @ApiProperty({
    description: 'Recipient wallet address (format depends on blockchain)',
    examples: {
      ethereum: {
        summary: 'Ethereum/EVM Address',
        value: '0x1234567890abcdef1234567890abcdef12345678',
      },
      bitcoin_legacy: {
        summary: 'Bitcoin Legacy Address',
        value: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa',
      },
      bitcoin_segwit: {
        summary: 'Bitcoin SegWit Address',
        value: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
      },
      solana: {
        summary: 'Solana Address',
        value: '11111111111111111111111111111112',
      },
    },
  })
  @IsString({ message: 'Address must be a string' })
  @IsNotEmpty({ message: 'Address is required' })
  @IsValidBlockchainAddress({
    message: 'Address format is invalid for the selected blockchain',
  })
  @Transform(({ value }) => value?.trim())
  address: string;

  @ApiProperty({
    description: 'Human-readable label for the beneficiary',
    example: 'My BSC Exchange Address',
    minLength: 1,
    maxLength: 100,
  })
  @IsString({ message: 'Label must be a string' })
  @IsNotEmpty({ message: 'Label is required' })
  @Length(1, 100, { message: 'Label must be between 1 and 100 characters' })
  @Transform(({ value }) => value?.trim().replace(/\s+/g, ' '))
  label: string;
}
