import type { UserSession } from '../auth/types';

import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

import { Auth } from '../../decorators/auth.decorator';
import { Session } from '../auth/auth.decorator';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { GetBeneficiariesDto } from './dto/get-beneficiaries.dto';

@Controller('beneficiaries')
@Auth()
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

  @Post()
  @ApiOperation({
    summary: 'Register withdrawal address',
    description: 'Register a new beneficiary address for cryptocurrency withdrawals',
  })
  @ApiBody({
    type: CreateBeneficiaryDto,
    examples: {
      bscUsdt: {
        summary: 'Register BSC USDT withdrawal address',
        description: 'Example for registering BSC USDT withdrawal address',
        value: {
          blockchainKey: 'eip155:56',
          tokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          address: '0x1234567890abcdef1234567890abcdef12345678',
          label: 'My BSC Exchange Address',
        },
      },
      ethUsdc: {
        summary: 'Register Ethereum USDC withdrawal address',
        description: 'Example for registering Ethereum USDC withdrawal address',
        value: {
          blockchainKey: 'eip155:1',
          tokenId: 'erc20:0xa0b86a33e6ba4c2f8b3dcc56b4c3b3f7b123f456',
          address: '0x8ba1f109551bd432803012645aa136ba40b34567',
          label: 'Hardware Wallet Ethereum',
        },
      },
      solUsdc: {
        summary: 'Register Solana USDC withdrawal address',
        description: 'Example for registering Solana USDC withdrawal address',
        value: {
          blockchainKey: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          tokenId: 'spl:EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          label: 'Solana Mobile Wallet',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Beneficiary address registered successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid request data',
  })
  create(@Session() session: UserSession, @Body() createBeneficiaryDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(session.user.id, createBeneficiaryDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get all beneficiaries',
    description:
      'Retrieve all registered beneficiary addresses for the authenticated user with optional filtering',
  })
  @ApiQuery({
    name: 'blockchainKey',
    required: false,
    description: 'Filter by blockchain key (CAIP-2 format)',
    example: 'eip155:56',
  })
  @ApiQuery({
    name: 'tokenId',
    required: false,
    description: 'Filter by token ID',
    example: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  })
  @ApiResponse({
    status: 200,
    description: 'List of beneficiary addresses retrieved successfully',
  })
  findAll(@Session() session: UserSession, @Query() query: GetBeneficiariesDto) {
    return this.beneficiariesService.findAll(session.user.id, query);
  }
}
