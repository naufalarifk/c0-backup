import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum RefundDecision {
  APPROVE = 'approve',
  REJECT = 'reject',
  REQUEST_INFO = 'request_info',
}

export enum FailureType {
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
  BLOCKCHAIN_REJECTION = 'BLOCKCHAIN_REJECTION',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  USER_ERROR = 'USER_ERROR',
}

export class AdminRefundDecisionDto {
  @ApiProperty({
    enum: RefundDecision,
    description: 'Administrative decision on the refund request',
    example: RefundDecision.APPROVE,
  })
  @IsEnum(RefundDecision)
  @IsNotEmpty()
  decision: RefundDecision;

  @ApiProperty({
    description: 'Detailed reason for the administrative decision',
    example: 'System error during blockchain transaction - platform responsibility',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;

  @ApiPropertyOptional({
    description: 'Additional notes or instructions for the user',
    example: 'Please verify your destination address before retrying',
  })
  @IsString()
  @IsOptional()
  adminNotes?: string;
}

export class FailedWithdrawalListQueryDto {
  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    default: 1,
  })
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 20,
    default: 20,
  })
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional({
    enum: FailureType,
    description: 'Filter by failure type',
  })
  @IsEnum(FailureType)
  @IsOptional()
  failureType?: FailureType;

  @ApiPropertyOptional({
    description: 'Filter by reviewer status (true = reviewed, false = pending)',
  })
  @IsOptional()
  reviewed?: boolean;
}

export class FailedWithdrawalDetailsDto {
  @ApiProperty({
    description: 'Withdrawal ID',
    example: '12345',
  })
  id: string;

  @ApiProperty({
    description: 'User information',
  })
  user: {
    id: string;
    email: string;
    name: string;
    phoneNumber?: string;
    kycStatus: string;
  };

  @ApiProperty({
    description: 'Withdrawal request details',
  })
  withdrawal: {
    amount: string;
    currencyBlockchainKey: string;
    currencyTokenId: string;
    beneficiaryAddress: string;
    requestDate: string;
    failedDate: string;
    failureReason: string;
    state: string;
  };

  @ApiProperty({
    description: 'Beneficiary information',
  })
  beneficiary: {
    id: string;
    address: string;
    label?: string;
    isVerified: boolean;
  };

  @ApiProperty({
    description: 'Transaction attempt details',
  })
  transactionDetails?: {
    transactionHash?: string;
    networkFee?: string;
    attempts: number;
    lastAttemptDate?: string;
  };

  @ApiProperty({
    description: 'Administrative review information',
  })
  adminReview?: {
    reviewerId?: string;
    reviewDate?: string;
    decision?: RefundDecision;
    reason?: string;
    adminNotes?: string;
  };

  @ApiProperty({
    description: 'System context information',
  })
  systemContext: {
    failureType: FailureType;
    networkStatus: string;
    platformWalletBalance: string;
    errorLogs: string[];
  };
}

export class FailedWithdrawalListDto {
  @ApiProperty({
    type: [FailedWithdrawalDetailsDto],
    description: 'List of failed withdrawals pending review',
  })
  withdrawals: FailedWithdrawalDetailsDto[];

  @ApiProperty({
    description: 'Total number of failed withdrawals',
    example: 45,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 3,
  })
  totalPages: number;
}

export class RefundProcessResponseDto {
  @ApiProperty({
    description: 'Success status of the refund process',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: 'Response message',
    example: 'Refund approved and processed successfully',
  })
  message: string;

  @ApiProperty({
    description: 'Withdrawal ID',
    example: '12345',
  })
  withdrawalId: string;

  @ApiProperty({
    description: 'Refund decision made',
    enum: RefundDecision,
    example: RefundDecision.APPROVE,
  })
  decision: RefundDecision;

  @ApiProperty({
    description: 'Refunded amount (only if approved)',
    example: '100.000000',
  })
  refundedAmount?: string;

  @ApiProperty({
    description: 'Transaction ID for the refund (only if approved)',
    example: 'refund_67890',
  })
  refundTransactionId?: string;

  @ApiProperty({
    description: 'Processing timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  processedAt: string;
}

export class AdminNotificationDto {
  @ApiProperty({
    description: 'Notification type',
    example: 'WithdrawalFailed',
  })
  type: string;

  @ApiProperty({
    description: 'Notification title',
    example: 'Withdrawal Failure Alert',
  })
  title: string;

  @ApiProperty({
    description: 'Withdrawal ID requiring attention',
    example: '12345',
  })
  withdrawalId: string;

  @ApiProperty({
    description: 'Failure type classification',
    enum: FailureType,
    example: FailureType.TRANSACTION_TIMEOUT,
  })
  failureType: FailureType;

  @ApiProperty({
    description: 'Detailed failure reason',
    example: 'Transaction not confirmed within 24 hours',
  })
  failureReason: string;

  @ApiProperty({
    description: 'Recommended administrative action',
    example: 'Review for potential refund - likely network congestion',
  })
  recommendedAction: string;

  @ApiProperty({
    description: 'Priority level for review',
    example: 'high',
  })
  priority: 'low' | 'medium' | 'high' | 'critical';

  @ApiProperty({
    description: 'Whether immediate action is required',
    example: true,
  })
  requiresAction: boolean;

  @ApiProperty({
    description: 'Link to withdrawal record for review',
    example: '/admin/withdrawals/failed/12345',
  })
  reviewLink: string;

  @ApiProperty({
    description: 'Notification creation timestamp',
    example: '2024-01-15T10:30:00Z',
  })
  createdAt: string;
}
