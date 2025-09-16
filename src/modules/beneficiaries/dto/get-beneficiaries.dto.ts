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
}
