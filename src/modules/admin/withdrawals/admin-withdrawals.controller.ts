import type { UserSession } from '../../auth/types';

import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Auth } from '../../../decorators/auth.decorator';
import { Session } from '../../auth/auth.decorator';
import {
  AdminRefundDecisionDto,
  FailedWithdrawalDetailsDto,
  FailedWithdrawalListDto,
  FailedWithdrawalListQueryDto,
  RefundProcessResponseDto,
} from './admin-withdrawal.dto';
import { AdminWithdrawalsService } from './admin-withdrawals.service';

@Controller('admin/withdrawals')
@ApiTags('Admin - Withdrawals')
@Auth(['Admin'])
@ApiBearerAuth()
export class AdminWithdrawalsController {
  constructor(private readonly adminWithdrawalsService: AdminWithdrawalsService) {}

  @Get('failed')
  @ApiOperation({
    summary: 'Get failed withdrawals for review',
    description:
      'WM-004 Step 2: Administrative Review Process - Retrieve failed withdrawals awaiting admin review',
  })
  @ApiQuery({
    name: 'page',
    description: 'Page number for pagination',
    type: 'number',
    required: false,
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    description: 'Number of items per page (max 100)',
    type: 'number',
    required: false,
    example: 20,
  })
  @ApiQuery({
    name: 'failureType',
    description: 'Filter by failure type',
    type: 'string',
    required: false,
    enum: [
      'TRANSACTION_TIMEOUT',
      'BLOCKCHAIN_REJECTION',
      'NETWORK_ERROR',
      'INVALID_ADDRESS',
      'INSUFFICIENT_FUNDS',
      'SYSTEM_ERROR',
      'USER_ERROR',
    ],
  })
  @ApiQuery({
    name: 'reviewed',
    description: 'Filter by review status (true = reviewed, false = pending)',
    type: 'boolean',
    required: false,
  })
  @ApiResponse({
    status: 200,
    description: 'List of failed withdrawals with pagination',
    type: FailedWithdrawalListDto,
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - admin authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient admin privileges',
  })
  async getFailedWithdrawals(
    @Query() query: FailedWithdrawalListQueryDto,
    @Session() session: UserSession,
  ): Promise<FailedWithdrawalListDto> {
    return this.adminWithdrawalsService.getFailedWithdrawals(query);
  }

  @Get('failed/:id')
  @ApiOperation({
    summary: 'Get detailed failed withdrawal information',
    description:
      'WM-004 Step 2: Administrative Review Process - Get comprehensive details for withdrawal review',
  })
  @ApiParam({
    name: 'id',
    description: 'Withdrawal ID',
    example: '12345',
  })
  @ApiResponse({
    status: 200,
    description: 'Detailed withdrawal information with system context',
    type: FailedWithdrawalDetailsDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - admin authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient admin privileges',
  })
  async getFailedWithdrawalDetails(
    @Param('id') withdrawalId: string,
    @Session() session: UserSession,
  ): Promise<FailedWithdrawalDetailsDto> {
    return this.adminWithdrawalsService.getFailedWithdrawalDetails(withdrawalId);
  }

  @Post('failed/:id/refund-decision')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 decisions per minute
  @ApiOperation({
    summary: 'Process admin refund decision',
    description:
      'WM-004 Step 3: Refund Processing Workflow - Make administrative decision on failed withdrawal refund',
  })
  @ApiParam({
    name: 'id',
    description: 'Withdrawal ID',
    example: '12345',
  })
  @ApiBody({
    type: AdminRefundDecisionDto,
    description: 'Administrative decision details',
    examples: {
      approve: {
        summary: 'Approve refund',
        value: {
          decision: 'approve',
          reason: 'System error during blockchain transaction - platform responsibility',
          adminNotes: 'Network congestion caused timeout. User should retry after refund.',
        },
      },
      reject: {
        summary: 'Reject refund',
        value: {
          decision: 'reject',
          reason: 'Invalid destination address provided by user',
          adminNotes: 'User must verify address format before new withdrawal attempt.',
        },
      },
      requestInfo: {
        summary: 'Request additional information',
        value: {
          decision: 'request_info',
          reason: 'Need clarification on destination address ownership',
          adminNotes: 'Please provide proof of address ownership before proceeding.',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Refund decision processed successfully',
    type: RefundProcessResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid decision or withdrawal already reviewed',
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal not found or not in failed state',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - admin authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient admin privileges',
  })
  async processRefundDecision(
    @Param('id') withdrawalId: string,
    @Body() decision: AdminRefundDecisionDto,
    @Session() session: UserSession,
  ): Promise<RefundProcessResponseDto> {
    // Log admin action for audit trail
    console.log(
      `[AUDIT] Admin ${session.user.id} processing refund decision for withdrawal ${withdrawalId}: ${decision.decision}`,
    );

    return this.adminWithdrawalsService.processRefundDecision(
      withdrawalId,
      session.user.id,
      decision,
    );
  }

  @Post('failed/:id/escalate')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 escalations per minute
  @ApiOperation({
    summary: 'Escalate complex withdrawal failure',
    description:
      'WM-004 Error Scenarios: Escalate complex failure scenarios to senior administrators',
  })
  @ApiParam({
    name: 'id',
    description: 'Withdrawal ID',
    example: '12345',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        escalationReason: {
          type: 'string',
          description: 'Reason for escalation',
          example: 'Complex blockchain failure requiring senior technical review',
        },
        priority: {
          type: 'string',
          enum: ['medium', 'high', 'critical'],
          description: 'Escalation priority level',
          example: 'high',
        },
        notes: {
          type: 'string',
          description: 'Additional context for senior admin',
          example: 'Transaction hash shows success on blockchain but platform failed to confirm',
        },
      },
      required: ['escalationReason', 'priority'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Escalation created successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Escalation created and senior admin notified' },
        escalationId: { type: 'string', example: 'esc_67890' },
        assignedTo: { type: 'string', example: 'senior-admin-team' },
        estimatedResponse: { type: 'string', example: '2-4 hours' },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Bad request - invalid escalation request',
  })
  @ApiResponse({
    status: 404,
    description: 'Withdrawal not found',
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - admin authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient admin privileges',
  })
  async escalateFailure(
    @Param('id') withdrawalId: string,
    @Body() escalation: {
      escalationReason: string;
      priority: 'medium' | 'high' | 'critical';
      notes?: string;
    },
    @Session() session: UserSession,
  ): Promise<{
    success: boolean;
    message: string;
    escalationId: string;
    assignedTo: string;
    estimatedResponse: string;
  }> {
    // Log escalation action for audit trail
    console.log(
      `[AUDIT] Admin ${session.user.id} escalating withdrawal ${withdrawalId}: ${escalation.escalationReason}`,
    );

    // TODO: Implement actual escalation logic with database storage
    return {
      success: true,
      message: 'Escalation created and senior admin notified',
      escalationId: `esc_${Date.now()}`,
      assignedTo: 'senior-admin-team',
      estimatedResponse:
        escalation.priority === 'critical'
          ? '1-2 hours'
          : escalation.priority === 'high'
            ? '2-4 hours'
            : '4-8 hours',
    };
  }

  @Get('stats')
  @ApiOperation({
    summary: 'Get withdrawal failure statistics',
    description:
      'WM-004 Administrative dashboard statistics for withdrawal failures and refund processing',
  })
  @ApiResponse({
    status: 200,
    description: 'Withdrawal failure statistics',
    schema: {
      type: 'object',
      properties: {
        totalFailed: { type: 'number', example: 42 },
        pendingReview: { type: 'number', example: 15 },
        approvedRefunds: { type: 'number', example: 20 },
        rejectedRefunds: { type: 'number', example: 7 },
        escalated: { type: 'number', example: 3 },
        failureBreakdown: {
          type: 'object',
          properties: {
            TRANSACTION_TIMEOUT: { type: 'number', example: 12 },
            NETWORK_ERROR: { type: 'number', example: 8 },
            BLOCKCHAIN_REJECTION: { type: 'number', example: 6 },
            SYSTEM_ERROR: { type: 'number', example: 5 },
            INVALID_ADDRESS: { type: 'number', example: 7 },
            INSUFFICIENT_FUNDS: { type: 'number', example: 2 },
            USER_ERROR: { type: 'number', example: 2 },
          },
        },
        averageResolutionTime: { type: 'string', example: '4.2 hours' },
        refundRate: { type: 'number', example: 74.1 },
      },
    },
  })
  @ApiResponse({
    status: 401,
    description: 'Unauthorized - admin authentication required',
  })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient admin privileges',
  })
  async getFailureStats(@Session() session: UserSession): Promise<{
    totalFailed: number;
    pendingReview: number;
    approvedRefunds: number;
    rejectedRefunds: number;
    escalated: number;
    failureBreakdown: Record<string, number>;
    averageResolutionTime: string;
    refundRate: number;
  }> {
    // TODO: Implement actual statistics from repository
    return {
      totalFailed: 42,
      pendingReview: 15,
      approvedRefunds: 20,
      rejectedRefunds: 7,
      escalated: 3,
      failureBreakdown: {
        TRANSACTION_TIMEOUT: 12,
        NETWORK_ERROR: 8,
        BLOCKCHAIN_REJECTION: 6,
        SYSTEM_ERROR: 5,
        INVALID_ADDRESS: 7,
        INSUFFICIENT_FUNDS: 2,
        USER_ERROR: 2,
      },
      averageResolutionTime: '4.2 hours',
      refundRate: 74.1,
    };
  }
}
