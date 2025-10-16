import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isInstanceOf,
  isNullable,
  isNumber,
  isString,
} from 'typeshaper';

import {
  AdminApprovesWithdrawalRefundParams,
  AdminApprovesWithdrawalRefundResult,
  AdminRejectsWithdrawalRefundParams,
  AdminRejectsWithdrawalRefundResult,
  AdminViewsFailedWithdrawalsParams,
  AdminViewsFailedWithdrawalsResult,
  AdminViewsWithdrawalDetailsParams,
  AdminWithdrawalDetailsResult,
} from './finance.types';
import { FinanceUserRepsitory } from './finance-user.repository';

export abstract class FinanceAdminRepository extends FinanceUserRepsitory {
  async adminApprovesWithdrawalRefund(
    params: AdminApprovesWithdrawalRefundParams,
  ): Promise<AdminApprovesWithdrawalRefundResult> {
    const { withdrawalId, reviewerUserId, approvalDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE withdrawals
        SET failure_refund_reviewer_user_id = ${reviewerUserId},
            failure_refund_approved_date = ${approvalDate.toISOString()},
            failure_refund_requested_date = ${approvalDate.toISOString()},
            status = 'RefundApproved'
        WHERE id = ${withdrawalId} AND status = 'Failed'
        RETURNING id, status, failure_refund_approved_date
      `;

      if (rows.length === 0) {
        throw new Error('Withdrawal refund approval failed');
      }

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal not found or update failed');
      assertProp(check(isString, isNumber), withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertProp(isInstanceOf(Date), withdrawal, 'failure_refund_approved_date');

      await tx.commitTransaction();

      return {
        id: String(withdrawal.id),
        status: withdrawal.status,
        failureRefundApprovedDate: withdrawal.failure_refund_approved_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminRejectsWithdrawalRefund(
    params: AdminRejectsWithdrawalRefundParams,
  ): Promise<AdminRejectsWithdrawalRefundResult> {
    const { withdrawalId, reviewerUserId, rejectionReason, rejectionDate } = params;

    const tx = await this.beginTransaction();
    try {
      const rows = await this.sql`
        UPDATE withdrawals
        SET failure_refund_reviewer_user_id = ${reviewerUserId},
            failure_refund_rejected_date = ${rejectionDate.toISOString()},
            failure_refund_requested_date = ${rejectionDate.toISOString()},
            failure_refund_rejection_reason = ${rejectionReason},
            status = 'RefundRejected'
        WHERE id = ${withdrawalId} AND status = 'Failed'
        RETURNING id, status, failure_refund_rejected_date
      `;

      if (rows.length === 0) {
        throw new Error('Withdrawal refund rejection failed');
      }

      const withdrawal = rows[0];
      assertDefined(withdrawal, 'Withdrawal not found or update failed');
      assertProp(check(isString, isNumber), withdrawal, 'id');
      assertPropString(withdrawal, 'status');
      assertProp(isInstanceOf(Date), withdrawal, 'failure_refund_rejected_date');

      await tx.commitTransaction();

      return {
        id: String(withdrawal.id),
        status: withdrawal.status,
        failureRefundRejectedDate: withdrawal.failure_refund_rejected_date,
      };
    } catch (error) {
      await tx.rollbackTransaction();
      throw error;
    }
  }

  async adminViewsFailedWithdrawals(
    params: AdminViewsFailedWithdrawalsParams,
  ): Promise<AdminViewsFailedWithdrawalsResult> {
    const { page = 1, limit = 20, failureType, reviewed } = params;
    const validatedPage = Math.max(1, page);
    const validatedLimit = Math.min(Math.max(1, limit), 100);
    const offset = (validatedPage - 1) * validatedLimit;

    // Get total count with filters
    const countRows = await this.sql`
      SELECT COUNT(*) as total
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      JOIN users u ON b.user_id = u.id
      LEFT JOIN user_kycs uk ON u.id = uk.user_id AND uk.status = 'Verified'
      WHERE w.status = 'Failed'
        AND (${failureType}::text IS NULL OR w.failure_reason ILIKE '%' || ${failureType} || '%')
        AND (${reviewed}::boolean IS NULL OR
          (${reviewed} = true AND w.failure_refund_reviewer_user_id IS NOT NULL) OR
          (${reviewed} = false AND w.failure_refund_reviewer_user_id IS NULL))
    `;

    const countRow = countRows[0] as { total: number };
    const total = Number(countRow.total);
    const totalPages = Math.ceil(total / validatedLimit);

    // Get withdrawals with user and beneficiary details
    const rows = await this.sql`
      SELECT
        w.id,
        b.user_id,
        u.email as user_email,
        u.name as user_name,
        u.phone_number as user_phone_number,
        uk.status as user_kyc_status,
        w.amount,
        w.currency_blockchain_key,
        w.currency_token_id,
        b.address as beneficiary_address,
        w.request_date,
        w.failed_date,
        w.failure_reason,
        w.status,
        w.sent_hash as transaction_hash,
        w.sent_amount as network_fee,
        w.failure_refund_reviewer_user_id as reviewer_id,
        w.failure_refund_approved_date as review_date,
        w.failure_refund_rejection_reason as review_reason,
        CASE WHEN w.failure_refund_approved_date IS NOT NULL THEN 'approve'
             WHEN w.failure_refund_rejected_date IS NOT NULL THEN 'reject'
             ELSE NULL END as review_decision
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      JOIN users u ON b.user_id = u.id
      LEFT JOIN user_kycs uk ON u.id = uk.user_id AND uk.status = 'Verified'
      WHERE w.status = 'Failed'
        AND (${failureType}::text IS NULL OR w.failure_reason ILIKE '%' || ${failureType} || '%')
        AND (${reviewed}::boolean IS NULL OR
          (${reviewed} = true AND w.failure_refund_reviewer_user_id IS NOT NULL) OR
          (${reviewed} = false AND w.failure_refund_reviewer_user_id IS NULL))
      ORDER BY w.failed_date DESC NULLS LAST, w.request_date DESC
      LIMIT ${validatedLimit} OFFSET ${offset}
    `;

    const withdrawals = rows.map(row => {
      assertDefined(row, 'Withdrawal record is undefined');
      assertProp(check(isString, isNumber), row, 'id');
      assertProp(check(isString, isNumber), row, 'user_id');
      assertPropString(row, 'user_email');
      assertPropString(row, 'user_name');
      assertProp(check(isNullable, isString), row, 'user_phone_number');
      assertProp(check(isNullable, isString), row, 'user_kyc_status');
      assertProp(check(isString, isNumber), row, 'amount');
      assertPropString(row, 'currency_blockchain_key');
      assertPropString(row, 'currency_token_id');
      assertPropString(row, 'beneficiary_address');
      assertProp(isInstanceOf(Date), row, 'request_date');
      assertProp(isInstanceOf(Date), row, 'failed_date');
      assertPropString(row, 'failure_reason');
      assertPropString(row, 'status');
      assertProp(check(isNullable, isString), row, 'transaction_hash');
      assertProp(check(isNullable, isString, isNumber), row, 'network_fee');
      assertProp(check(isNullable, isString, isNumber), row, 'reviewer_id');
      assertProp(check(isNullable, isInstanceOf(Date)), row, 'review_date');
      assertProp(check(isNullable, isString), row, 'review_decision');
      assertProp(check(isNullable, isString), row, 'review_reason');

      return {
        id: String(row.id),
        userId: String(row.user_id),
        userEmail: row.user_email,
        userName: row.user_name,
        userPhoneNumber: row.user_phone_number || undefined,
        userKycStatus: row.user_kyc_status,
        amount: row.amount,
        currencyBlockchainKey: row.currency_blockchain_key,
        currencyTokenId: row.currency_token_id,
        beneficiaryAddress: row.beneficiary_address,
        requestDate:
          row.request_date instanceof Date
            ? row.request_date.toISOString()
            : String(row.request_date),
        failedDate: row.failed_date
          ? row.failed_date instanceof Date
            ? row.failed_date.toISOString()
            : String(row.failed_date)
          : undefined,
        failureReason: row.failure_reason,
        status: row.status,
        transactionHash: row.transaction_hash || undefined,
        networkFee: row.network_fee || undefined,
        attempts: 1,
        lastAttemptDate: row.failed_date
          ? row.failed_date instanceof Date
            ? row.failed_date.toISOString()
            : String(row.failed_date)
          : undefined,
        reviewerId: row.reviewer_id || undefined,
        reviewDate: row.review_date
          ? row.review_date instanceof Date
            ? row.review_date.toISOString()
            : String(row.review_date)
          : undefined,
        reviewDecision: row.review_decision || undefined,
        reviewReason: row.review_reason || undefined,
        adminNotes: undefined,
      };
    });

    return {
      // biome-ignore lint/suspicious/noExplicitAny: Allow any
      withdrawals: withdrawals as any,
      total,
      page: validatedPage,
      limit: validatedLimit,
      totalPages,
    };
  }

  async adminViewsWithdrawalDetails(
    params: AdminViewsWithdrawalDetailsParams,
  ): Promise<AdminWithdrawalDetailsResult | null> {
    const { withdrawalId } = params;

    const rows = await this.sql`
      SELECT
        w.id,
        b.user_id,
        u.email as user_email,
        u.name as user_name,
        u.phone_number as user_phone_number,
        uk.status as user_kyc_status,
        w.amount,
        w.currency_blockchain_key,
        w.currency_token_id,
        b.address as beneficiary_address,
        w.request_date,
        w.failed_date,
        w.failure_reason,
        w.status,
        w.sent_hash as transaction_hash,
        w.sent_amount as network_fee,
        w.failure_refund_reviewer_user_id as reviewer_id,
        w.failure_refund_approved_date as review_date,
        w.failure_refund_rejection_reason as review_reason,
        CASE WHEN w.failure_refund_approved_date IS NOT NULL THEN 'approve'
             WHEN w.failure_refund_rejected_date IS NOT NULL THEN 'reject'
             ELSE NULL END as review_decision
      FROM withdrawals w
      JOIN beneficiaries b ON w.beneficiary_id = b.id
      JOIN users u ON b.user_id = u.id
      LEFT JOIN user_kycs uk ON u.id = uk.user_id AND uk.status = 'Verified'
      WHERE w.id = ${withdrawalId}
    `;

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0] as {};
    assertProp(check(isString, isNumber), row, 'id');
    assertProp(check(isString, isNumber), row, 'user_id');
    assertPropString(row, 'user_email');
    assertPropString(row, 'user_name');
    assertProp(check(isNullable, isString), row, 'user_phone_number');
    assertProp(check(isNullable, isString), row, 'user_kyc_status');
    assertProp(check(isString, isNumber), row, 'amount');
    assertPropString(row, 'currency_blockchain_key');
    assertPropString(row, 'currency_token_id');
    assertPropString(row, 'beneficiary_address');
    assertProp(isInstanceOf(Date), row, 'request_date');
    assertProp(isInstanceOf(Date), row, 'failed_date');
    assertPropString(row, 'failure_reason');
    assertProp(check(isNullable, isString, isNumber), row, 'network_fee');
    assertPropString(row, 'status');
    assertProp(check(isNullable, isString), row, 'transaction_hash');
    assertProp(check(isNullable, isString, isNumber), row, 'reviewer_id');
    assertProp(check(isNullable, isInstanceOf(Date)), row, 'review_date');
    assertProp(check(isNullable, isString), row, 'review_decision');
    assertProp(check(isNullable, isString), row, 'review_reason');

    const withdrawal = {
      id: String(row.id),
      userId: String(row.user_id),
      userEmail: row.user_email,
      userName: row.user_name,
      userPhoneNumber: row.user_phone_number || undefined,
      userKycStatus: row.user_kyc_status,
      amount: row.amount,
      currencyBlockchainKey: row.currency_blockchain_key,
      currencyTokenId: row.currency_token_id,
      beneficiaryAddress: row.beneficiary_address,
      requestDate: row.request_date,
      failedDate: row.failed_date,
      failureReason: row.failure_reason,
      status: row.status,
      transactionHash: row.transaction_hash || undefined,
      networkFee: row.network_fee || undefined,
      attempts: 1,
      lastAttemptDate: row.failed_date,
      reviewerId: row.reviewer_id || undefined,
      reviewDate: row.review_date || undefined,
      reviewDecision: row.review_decision || undefined,
      reviewReason: row.review_reason || undefined,
      adminNotes: undefined,
    };

    // Analyze failure type from failure reason
    const failureReason = row.failure_reason.toLowerCase();
    let failureType = 'SYSTEM_ERROR';
    if (failureReason.includes('timeout')) failureType = 'TRANSACTION_TIMEOUT';
    else if (failureReason.includes('network')) failureType = 'NETWORK_ERROR';
    else if (failureReason.includes('address')) failureType = 'INVALID_ADDRESS';
    else if (failureReason.includes('insufficient')) failureType = 'INSUFFICIENT_FUNDS';
    else if (failureReason.includes('rejected')) failureType = 'BLOCKCHAIN_REJECTION';

    return {
      // biome-ignore lint/suspicious/noExplicitAny: Allow any
      withdrawal: withdrawal as any,
      systemContext: {
        failureType,
        networkStatus: 'operational',
        platformWalletBalance: '1000000.00',
        errorLogs: [row.failure_reason],
      },
    };
  }
}
