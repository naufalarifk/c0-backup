import { ApiPropertyOptional } from '@nestjs/swagger';

import { IsOptional, IsString, Matches } from 'class-validator';

export class GetBeneficiariesDto {
  @ApiPropertyOptional({
    description: 'Filter by blockchain key (CAIP-2 format)',
    examples: {
      ethereum: {
        summary: 'Ethereum Mainnet',
        value: 'eip155:1',
      },
      bsc: {
        summary: 'BSC Mainnet',
        value: 'eip155:56',
      },
      solana: {
        summary: 'Solana Mainnet',
        value: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
      },
      bitcoin: {
        summary: 'Bitcoin Mainnet',
        value: 'bip122:000000000019d6689c085ae165831e93',
      },
      crosschain: {
        summary: 'Cross-Chain',
        value: 'crosschain',
      },
    },
  })
  @IsOptional()
  @IsString()
  @Matches(
    /^(crosschain|eip155:[1-9]\d*|bip122:[0-9a-f]{64}|solana:[1-9A-HJ-NP-Za-km-z]{32,44})$/,
    {
      message:
        'blockchainKey must be valid format (e.g., eip155:1, bip122:000000000019d6689c085ae165831e93, solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp, crosschain)',
    },
  )
  blockchainKey?: string;

  @ApiPropertyOptional({
    description: 'Filter by token ID',
    examples: {
      ethUsdc: {
        summary: 'Ethereum USDC',
        value: 'erc20:0xa0b86a33e6ba4c2f8b3dcc56b4c3b3f7b123f456',
      },
      bscUsdt: {
        summary: 'BSC USDT',
        value: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
      },
      solUsdc: {
        summary: 'Solana USDC',
        value: 'spl:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
      },
      btc: {
        summary: 'Bitcoin',
        value: 'slip44:0',
      },
    },
  })
  @IsOptional()
  @IsString()
  @Matches(
    /^(erc20:0x[a-fA-F0-9]{40}|bep20:0x[a-fA-F0-9]{40}|spl:[1-9A-HJ-NP-Za-km-z]{32,44}|brc20:[a-zA-Z0-9]{1,4}|slip44:\d+)$/,
    {
      message:
        'tokenId must be in valid format (e.g., erc20:0x..., bep20:0x..., spl:..., brc20:..., slip44:0)',
    },
  )
  tokenId?: string;
}
