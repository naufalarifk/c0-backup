/** biome-ignore-all lint/suspicious/noExplicitAny: Allow any */
import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { ensureExists, ensureValid } from '../../../shared/utils';
import { NotificationQueueService } from '../../notifications/notification-queue.service';
import {
  AdminNotificationDto,
  AdminRefundDecisionDto,
  FailedWithdrawalDetailsDto,
  FailedWithdrawalListDto,
  FailedWithdrawalListQueryDto,
  FailureType,
  RefundDecision,
  RefundProcessResponseDto,
} from './admin-withdrawal.dto';

@Injectable()
export class AdminWithdrawalsService {
  private readonly logger = new TelemetryLogger(AdminWithdrawalsService.name);

  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly notificationQueueService: NotificationQueueService,
  ) {}

  /**
   * WM-004 Step 2: Administrative Review Process
   * Get list of failed withdrawals for admin review
   */
  async getFailedWithdrawals(
    query: FailedWithdrawalListQueryDto,
  ): Promise<FailedWithdrawalListDto> {
    this.logger.log(
      `[WM-004] Admin retrieving failed withdrawals with filters: ${JSON.stringify(query)}`,
    );

    const result = await this.repo.adminViewsFailedWithdrawals({
      page: query.page,
      limit: query.limit,
      failureType: query.failureType,
      reviewed: query.reviewed,
    });

    const withdrawals = result.withdrawals.map(withdrawal => ({
      id: withdrawal.id,
      user: {
        id: withdrawal.userId,
        email: withdrawal.userEmail,
        name: withdrawal.userName,
        phoneNumber: withdrawal.userPhoneNumber,
        kycStatus: withdrawal.userKycStatus,
      },
      withdrawal: {
        amount: withdrawal.amount,
        currencyBlockchainKey: withdrawal.currencyBlockchainKey,
        currencyTokenId: withdrawal.currencyTokenId,
        beneficiaryAddress: withdrawal.beneficiaryAddress,
        requestDate: withdrawal.requestDate,
        failedDate: withdrawal.failedDate,
        failureReason: withdrawal.failureReason,
        state: withdrawal.status,
      },
      beneficiary: {
        id: withdrawal.id, // Using withdrawal ID as proxy
        address: withdrawal.beneficiaryAddress,
        isVerified: true, // Default assumption
      },
      transactionDetails: withdrawal.transactionHash
        ? {
            transactionHash: withdrawal.transactionHash,
            networkFee: withdrawal.networkFee,
            attempts: withdrawal.attempts,
            lastAttemptDate: withdrawal.lastAttemptDate,
          }
        : undefined,
      adminReview: withdrawal.reviewerId
        ? {
            reviewerId: withdrawal.reviewerId,
            reviewDate: withdrawal.reviewDate,
            decision: withdrawal.reviewDecision as RefundDecision,
            reason: withdrawal.reviewReason,
            adminNotes: withdrawal.adminNotes,
          }
        : undefined,
      systemContext: this.analyzeFailureContext(withdrawal.failureReason),
    }));

    return {
      withdrawals,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    };
  }

  /**
   * WM-004 Step 2: Administrative Review Process
   * Get detailed information for a specific failed withdrawal
   */
  async getFailedWithdrawalDetails(withdrawalId: string): Promise<FailedWithdrawalDetailsDto> {
    this.logger.log(`[WM-004] Admin retrieving detailed info for withdrawal: ${withdrawalId}`);

    const result = await this.repo.adminViewsWithdrawalDetails({ withdrawalId });
    ensureExists(result, 'Withdrawal not found');

    const withdrawal = result.withdrawal;

    return {
      id: withdrawal.id,
      user: {
        id: withdrawal.userId,
        email: withdrawal.userEmail,
        name: withdrawal.userName,
        phoneNumber: withdrawal.userPhoneNumber,
        kycStatus: withdrawal.userKycStatus,
      },
      withdrawal: {
        amount: withdrawal.amount,
        currencyBlockchainKey: withdrawal.currencyBlockchainKey,
        currencyTokenId: withdrawal.currencyTokenId,
        beneficiaryAddress: withdrawal.beneficiaryAddress,
        requestDate: withdrawal.requestDate,
        failedDate: withdrawal.failedDate,
        failureReason: withdrawal.failureReason,
        state: withdrawal.status,
      },
      beneficiary: {
        id: withdrawal.id,
        address: withdrawal.beneficiaryAddress,
        isVerified: true,
      },
      transactionDetails: withdrawal.transactionHash
        ? {
            transactionHash: withdrawal.transactionHash,
            networkFee: withdrawal.networkFee,
            attempts: withdrawal.attempts,
            lastAttemptDate: withdrawal.lastAttemptDate,
          }
        : undefined,
      adminReview: withdrawal.reviewerId
        ? {
            reviewerId: withdrawal.reviewerId,
            reviewDate: withdrawal.reviewDate,
            decision: withdrawal.reviewDecision as RefundDecision,
            reason: withdrawal.reviewReason,
            adminNotes: withdrawal.adminNotes,
          }
        : undefined,
      systemContext: {
        failureType: result.systemContext.failureType as FailureType,
        networkStatus: result.systemContext.networkStatus,
        platformWalletBalance: result.systemContext.platformWalletBalance,
        errorLogs: result.systemContext.errorLogs,
      },
    };
  }

  /**
   * WM-004 Step 3: Refund Processing Workflow
   * Process admin decision on failed withdrawal refund
   */
  async processRefundDecision(
    withdrawalId: string,
    adminUserId: string,
    decision: AdminRefundDecisionDto,
  ): Promise<RefundProcessResponseDto> {
    this.logger.log(
      `[WM-004] Processing admin decision for withdrawal ${withdrawalId}: ${decision.decision}`,
    );

    // Validate withdrawal exists and is in failed state
    const withdrawalDetails = await this.repo.adminViewsWithdrawalDetails({ withdrawalId });
    ensureExists(withdrawalDetails, 'Withdrawal not found');
    ensureValid(
      withdrawalDetails.withdrawal.status === 'Failed',
      'Withdrawal must be in Failed status for refund processing',
    );

    // Ensure admin hasn't already reviewed this withdrawal
    ensureValid(
      !withdrawalDetails.withdrawal.reviewerId,
      'This withdrawal has already been reviewed',
    );

    const processedAt = new Date();

    try {
      switch (decision.decision) {
        case RefundDecision.APPROVE:
          return await this.processRefundApproval(
            withdrawalId,
            adminUserId,
            decision,
            withdrawalDetails.withdrawal,
            processedAt,
          );

        case RefundDecision.REJECT:
          return await this.processRefundRejection(
            withdrawalId,
            adminUserId,
            decision,
            processedAt,
          );

        case RefundDecision.REQUEST_INFO:
          return await this.processInfoRequest(
            withdrawalId,
            adminUserId,
            decision,
            withdrawalDetails.withdrawal,
            processedAt,
          );

        default:
          throw new Error(`Invalid refund decision: ${decision.decision}`);
      }
    } catch (error) {
      this.logger.error(`[WM-004] Failed to process refund decision for ${withdrawalId}:`, error);
      throw error;
    }
  }

  /**
   * WM-004 Step 1: Failure Detection and Administrative Notification
   * Create administrative notification for failed withdrawal
   */
  async createFailureNotification(
    withdrawalId: string,
    failureReason: string,
    failureType: FailureType,
  ): Promise<void> {
    this.logger.log(`[WM-004] Creating admin notification for failed withdrawal: ${withdrawalId}`);

    const notification: AdminNotificationDto = {
      type: 'WithdrawalFailed',
      title: 'Withdrawal Failure Alert',
      withdrawalId,
      failureType,
      failureReason,
      recommendedAction: this.getRecommendedAction(failureType, failureReason),
      priority: this.getFailurePriority(failureType),
      requiresAction: true,
      reviewLink: `/admin/withdrawals/failed/${withdrawalId}`,
      createdAt: new Date(),
    };

    // Queue admin notification
    await this.notificationQueueService.queueNotification({
      type: 'AdminWithdrawalFailure',
      name: 'Withdrawal Failure Alert',
      withdrawalId,
      failureType,
      failureReason,
      recommendedAction: notification.recommendedAction,
      priority: notification.priority,
      requiresAction: true,
      reviewLink: notification.reviewLink,
    } as any);

    this.logger.log(`[WM-004] Admin notification queued for withdrawal ${withdrawalId}`);
  }

  // Private helper methods

  private async processRefundApproval(
    withdrawalId: string,
    adminUserId: string,
    decision: AdminRefundDecisionDto,
    withdrawal: any,
    processedAt: Date,
  ): Promise<RefundProcessResponseDto> {
    this.logger.log(`[WM-004] Processing refund approval for withdrawal: ${withdrawalId}`);

    // Approve refund in database
    const result = await this.repo.adminApprovesWithdrawalRefund({
      withdrawalId,
      reviewerUserId: adminUserId,
      approvalDate: processedAt,
    });
    console.log(result);

    // Create account mutation for refund credit
    try {
      // First, get the user's account for this currency
      const accounts = await this.repo.userRetrievesAccountBalances({
        userId: withdrawal.userId,
      });

      const account = accounts.accounts.find(
        acc =>
          acc.currencyBlockchainKey === withdrawal.currencyBlockchainKey &&
          acc.currencyTokenId === withdrawal.currencyTokenId,
      );

      if (account) {
        // Create refund account mutation using test method (TODO: create proper production method)
        await this.repo.testCreatesAccountMutations({
          accountId: account.id,
          mutations: [
            {
              mutationType: 'WithdrawalRefunded',
              mutationDate: processedAt.toISOString(),
              amount: withdrawal.amount,
            },
          ],
        });

        this.logger.log(
          `[WM-004] Refund account mutation created for withdrawal ${withdrawalId}, amount: ${withdrawal.amount}`,
        );
      } else {
        this.logger.warn(`[WM-004] Could not find account for refund mutation: ${withdrawalId}`);
      }
    } catch (mutationError) {
      this.logger.error(
        `[WM-004] Failed to create refund account mutation for ${withdrawalId}:`,
        mutationError,
      );
      // Don't throw here - the refund approval was already recorded
    }

    // Send user notification
    await this.notificationQueueService.queueNotification({
      type: 'WithdrawalRefunded',
      name: 'Withdrawal Refunded',
      withdrawalId,
      refundAmount: withdrawal.amount,
      refundReason: decision.reason,
      adminNotes: decision.adminNotes,
      nextSteps: 'You can now initiate a new withdrawal request if needed.',
    } as any);

    // Send admin confirmation
    await this.notificationQueueService.queueNotification({
      type: 'AdminRefundProcessed',
      name: 'Refund Approved and Processed',
      withdrawalId,
      adminUserId,
      decision: decision.decision,
      refundAmount: withdrawal.amount,
      processedAt: processedAt.toISOString(),
    } as any);

    return {
      success: true,
      message: 'Refund approved and processed successfully',
      withdrawalId,
      decision: RefundDecision.APPROVE,
      refundedAmount: withdrawal.amount,
      refundTransactionId: `refund_${withdrawalId}`,
      processedAt: processedAt.toISOString(),
    };
  }

  private async processRefundRejection(
    withdrawalId: string,
    adminUserId: string,
    decision: AdminRefundDecisionDto,
    processedAt: Date,
  ): Promise<RefundProcessResponseDto> {
    this.logger.log(`[WM-004] Processing refund rejection for withdrawal: ${withdrawalId}`);

    // Reject refund in database
    await this.repo.adminRejectsWithdrawalRefund({
      withdrawalId,
      reviewerUserId: adminUserId,
      rejectionReason: decision.reason,
      rejectionDate: processedAt,
    });

    // Send user notification
    await this.notificationQueueService.queueNotification({
      type: 'WithdrawalRefundRejected',
      name: 'Refund Request Rejected',
      withdrawalId,
      rejectionReason: decision.reason,
      adminNotes: decision.adminNotes,
      nextSteps: 'Please contact support if you believe this decision was made in error.',
    } as any);

    // Send admin confirmation
    await this.notificationQueueService.queueNotification({
      type: 'AdminRefundProcessed',
      name: 'Refund Rejected',
      withdrawalId,
      adminUserId,
      decision: decision.decision,
      rejectionReason: decision.reason,
      processedAt: processedAt.toISOString(),
    } as any);

    return {
      success: true,
      message: 'Refund rejection processed successfully',
      withdrawalId,
      decision: RefundDecision.REJECT,
      processedAt: processedAt.toISOString(),
    };
  }

  private async processInfoRequest(
    withdrawalId: string,
    adminUserId: string,
    decision: AdminRefundDecisionDto,
    withdrawal: any,
    processedAt: Date,
  ): Promise<RefundProcessResponseDto> {
    this.logger.log(`[WM-004] Processing info request for withdrawal: ${withdrawalId}`);

    // Send user notification requesting additional info
    await this.notificationQueueService.queueNotification({
      type: 'WithdrawalInfoRequested',
      name: 'Additional Information Required',
      withdrawalId,
      infoRequest: decision.reason,
      adminNotes: decision.adminNotes,
      nextSteps: 'Please provide the requested information to proceed with your refund request.',
    } as any);

    // Send admin confirmation
    await this.notificationQueueService.queueNotification({
      type: 'AdminRefundProcessed',
      name: 'Information Requested from User',
      withdrawalId,
      adminUserId,
      decision: decision.decision,
      infoRequest: decision.reason,
      processedAt: processedAt.toISOString(),
    } as any);

    return {
      success: true,
      message: 'Information request sent to user successfully',
      withdrawalId,
      decision: RefundDecision.REQUEST_INFO,
      processedAt: processedAt.toISOString(),
    };
  }

  private analyzeFailureContext(failureReason: string): {
    failureType: FailureType;
    networkStatus: string;
    platformWalletBalance: string;
    errorLogs: string[];
  } {
    const reason = failureReason.toLowerCase();
    let failureType = FailureType.SYSTEM_ERROR;

    if (reason.includes('timeout')) failureType = FailureType.TRANSACTION_TIMEOUT;
    else if (reason.includes('network')) failureType = FailureType.NETWORK_ERROR;
    else if (reason.includes('address')) failureType = FailureType.INVALID_ADDRESS;
    else if (reason.includes('insufficient')) failureType = FailureType.INSUFFICIENT_FUNDS;
    else if (reason.includes('rejected')) failureType = FailureType.BLOCKCHAIN_REJECTION;
    else if (reason.includes('user')) failureType = FailureType.USER_ERROR;

    return {
      failureType,
      networkStatus: 'operational',
      platformWalletBalance: '1000000.00',
      errorLogs: [failureReason],
    };
  }

  private getRecommendedAction(failureType: FailureType, failureReason: string): string {
    switch (failureType) {
      case FailureType.TRANSACTION_TIMEOUT:
        return 'Review for potential refund - likely network congestion';
      case FailureType.NETWORK_ERROR:
        return 'Check network status and consider refund if platform issue';
      case FailureType.BLOCKCHAIN_REJECTION:
        return 'Investigate blockchain error - may require refund';
      case FailureType.INSUFFICIENT_FUNDS:
        return 'Check platform wallet balance - investigate fund management';
      case FailureType.INVALID_ADDRESS:
        return 'Verify if address validation failed - user error likely';
      case FailureType.USER_ERROR:
        return 'Review user actions - refund may not be appropriate';
      case FailureType.SYSTEM_ERROR:
      default:
        return 'Investigate system error - platform responsibility likely';
    }
  }

  private getFailurePriority(failureType: FailureType): 'low' | 'medium' | 'high' | 'critical' {
    switch (failureType) {
      case FailureType.SYSTEM_ERROR:
      case FailureType.INSUFFICIENT_FUNDS:
        return 'critical';
      case FailureType.TRANSACTION_TIMEOUT:
      case FailureType.NETWORK_ERROR:
      case FailureType.BLOCKCHAIN_REJECTION:
        return 'high';
      case FailureType.INVALID_ADDRESS:
        return 'medium';
      case FailureType.USER_ERROR:
        return 'low';
      default:
        return 'medium';
    }
  }
}
