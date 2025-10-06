import type { UserSession } from '../auth/types';

import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Auth } from '../../decorators/auth.decorator';
import { Session } from '../auth/auth.decorator';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import {
  WithdrawalCreatedResponseDto,
  WithdrawalRecordDto,
  WithdrawalRefundRequestResponseDto,
  WithdrawalsListResponseDto,
} from './dto/withdrawal-response.dto';
import { WithdrawalsService } from './withdrawals.service';

@Controller('withdrawals')
@Auth()
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Create withdrawal request',
    description:
      'Create a new withdrawal request to a registered beneficiary address with comprehensive validation and 2FA verification',
  })
  @ApiBody({
    type: CreateWithdrawalDto,
    description: 'Withdrawal request data',
    examples: {
      example1: {
        summary: 'USDT withdrawal on BSC',
        value: {
          beneficiaryId: '1',
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          amount: '1500.000000000000000000',
          twoFactorCode: '123456',
          phoneNumberCode: '123456',
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'Withdrawal request created successfully',
    type: WithdrawalCreatedResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - validation failed, insufficient balance, or invalid parameters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - invalid or missing authentication',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Forbidden - 2FA verification failed, KYC not verified, or 2FA not enabled',
  })
  async create(
    @Headers() headers: Record<string, string>,
    @Session() session: UserSession,
    @Body() createWithdrawalDto: CreateWithdrawalDto,
  ): Promise<WithdrawalCreatedResponseDto> {
    return this.withdrawalsService.create(headers, session.user, createWithdrawalDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user withdrawals',
    description: 'Retrieve all withdrawal requests for the authenticated user with pagination',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (starts from 1)',
    required: false,
    type: 'number',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of withdrawals per page (max 100)',
    required: false,
    type: 'number',
    example: 20,
  })
  @ApiQuery({
    name: 'state',
    description: 'Filter withdrawals by state',
    required: false,
    type: 'string',
    enum: ['requested', 'sent', 'confirmed', 'failed'],
    example: 'requested',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'List of user withdrawals with pagination',
    type: WithdrawalsListResponseDto,
  })
  findAll(
    @Session() session: UserSession,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('state') state?: 'requested' | 'sent' | 'confirmed' | 'failed',
  ) {
    return this.withdrawalsService.findAll(session.user.id, page, limit, state);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Get withdrawal by ID',
    description: 'Retrieve a specific withdrawal request by ID',
  })
  @ApiParam({
    name: 'id',
    description: 'Withdrawal ID',
    example: '1234',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Withdrawal details',
    type: WithdrawalRecordDto,
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Withdrawal not found',
  })
  findOne(@Param('id') id: string, @Session() session: UserSession) {
    return this.withdrawalsService.findOne(session.user.id, id);
  }

  @Post(':id/refund')
  @ApiOperation({
    summary: 'Request withdrawal refund',
    description: 'Request a refund for a failed withdrawal (admin approval required)',
  })
  @ApiParam({
    name: 'id',
    description: 'Withdrawal ID',
    example: '1234',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Refund request submitted successfully, pending admin approval',
    type: WithdrawalRefundRequestResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - withdrawal not eligible for refund or already processed',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Withdrawal not found or does not belong to user',
  })
  refund(@Param('id') id: string, @Session() session: UserSession) {
    return this.withdrawalsService.refund(session.user.id, id);
  }
}
