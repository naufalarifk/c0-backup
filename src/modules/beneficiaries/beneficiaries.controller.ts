import type { Response } from 'express';
import type { UserSession } from '../auth/types';

import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Auth } from '../../decorators/auth.decorator';
import { Session } from '../auth/auth.decorator';
import { BeneficiariesService } from './beneficiaries.service';
import { CreateBeneficiaryDto } from './dto/create-beneficiary.dto';
import { GetBeneficiariesDto } from './dto/get-beneficiaries.dto';

@Controller('beneficiaries')
@Auth()
@ApiTags('Beneficiaries')
export class BeneficiariesController {
  constructor(private readonly beneficiariesService: BeneficiariesService) {}

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
  @ApiResponse({
    status: 200,
    description: 'List of beneficiary addresses retrieved successfully',
  })
  findAll(@Session() session: UserSession, @Query() query: GetBeneficiariesDto) {
    return this.beneficiariesService.findAll(session.user.id, query);
  }

  @Post()
  @Throttle({ default: { limit: 3, ttl: 3_600 * 1_000 } })
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
          address: '0x1234567890abcdef1234567890abcdef12345678',
          label: 'My BSC Exchange Address',
          callbackURL: 'https://example.com/withdrawals',
        },
      },
      ethUsdc: {
        summary: 'Register Ethereum USDC withdrawal address',
        description: 'Example for registering Ethereum USDC withdrawal address',
        value: {
          blockchainKey: 'eip155:1',
          address: '0x8ba1f109551bd432803012645aa136ba40b34567',
          label: 'Hardware Wallet Ethereum',
          callbackURL: '/withdrawals',
        },
      },
      solUsdc: {
        summary: 'Register Solana USDC withdrawal address',
        description: 'Example for registering Solana USDC withdrawal address',
        value: {
          blockchainKey: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
          address: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          label: 'Solana Mobile Wallet',
          callbackURL: '/withdrawals',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Beneficiary address registered successfully',
  })
  create(@Session() session: UserSession, @Body() createBeneficiaryDto: CreateBeneficiaryDto) {
    return this.beneficiariesService.create(session.user.id, createBeneficiaryDto);
  }

  @Get('verify')
  @ApiOperation({
    summary: 'Verify beneficiary address',
    description:
      'Verify and activate a beneficiary address using the token sent via email. On successful verification, redirects to the callback URL.',
  })
  @ApiQuery({
    name: 'token',
    description: 'Verification token received via email',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    required: true,
  })
  @ApiQuery({
    name: 'callbackURL',
    description: 'Optional callback URL to redirect after verification',
    example: '/withdrawal',
    required: false,
  })
  @ApiResponse({
    status: 302,
    description:
      'Beneficiary address verified and activated successfully, redirecting to callback URL',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid or expired token',
  })
  @ApiResponse({
    status: 409,
    description: 'Address already exists or conflicts with existing beneficiary',
  })
  async verify(
    @Query('token') token: string,
    @Query('callbackURL') callbackURL: string | undefined,
    @Res() res: Response,
  ) {
    try {
      const result = await this.beneficiariesService.verify({ token, callbackURL });

      // Extract redirect URL from the service response
      const redirectURL = result.data?.redirectURL || '/';

      // Redirect to the callback URL with success status
      return res.redirect(`${redirectURL}?status=success&beneficiaryId=${result.data?.id}`);
    } catch (error) {
      // On error, redirect to callback URL with error status
      const errorRedirectURL = callbackURL || '/';

      return res.redirect(
        `${errorRedirectURL}?status=error&message=${error?.message || 'Verification failed'}`,
      );
    }
  }
}
