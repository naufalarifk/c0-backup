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
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

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

@ApiTags('Withdrawals')
@Controller('withdrawals')
@Auth()
@ApiBearerAuth()
export class WithdrawalsController {
  constructor(private readonly withdrawalsService: WithdrawalsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
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
          beneficiaryId: '301',
          currencyBlockchainKey: 'eip155:56',
          currencyTokenId: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          amount: '1500.000000000000000000',
          twoFactorCode: '123456',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Withdrawal request created successfully',
    type: WithdrawalCreatedResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - validation failed, insufficient balance, or invalid parameters',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - invalid or missing authentication',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - 2FA verification failed, KYC not verified, or 2FA not enabled',
  })
  async create(
    @Headers() headers: HeadersInit,
    @Session() session: UserSession,
    @Body() createWithdrawalDto: CreateWithdrawalDto,
  ): Promise<WithdrawalCreatedResponseDto> {
    return this.withdrawalsService.create(headers, session.user.id, createWithdrawalDto);
  }

  @Get()
  @ApiOperation({
    summary: 'Get user withdrawals',
    description: 'Retrieve all withdrawal requests for the authenticated user with pagination',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number (starts from 1)',
    type: 'number',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of withdrawals per page (max 100)',
    type: 'number',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'state',
    description: 'Filter withdrawals by state',
    type: 'string',
    required: false,
    enum: ['requested', 'sent', 'confirmed', 'failed'],
    example: 'requested',
  })
  @ApiResponse({
    status: 200,
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
    status: 200,
    description: 'Withdrawal details',
    type: WithdrawalRecordDto,
  })
  @ApiResponse({
    status: 404,
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
    status: 200,
    description: 'Refund request submitted successfully, pending admin approval',
    type: WithdrawalRefundRequestResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - withdrawal not eligible for refund or already processed',
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal not found or does not belong to user',
  })
  refund(@Param('id') id: string, @Session() session: UserSession) {
    return this.withdrawalsService.refund(session.user.id, id);
  }
}
