import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import {
  ensureExists,
  ensureInRange,
  ensurePermission,
  ensureUnique,
  ensureValid,
  isPositiveNumber,
} from '../../shared/utils';
import { AuthService } from '../auth/auth.service';
import { UserSession } from '../auth/types';
import { SMSWithdrawalRequestedNotificationData } from '../notifications/composers/withdrawal-requested-notification.composer';
import { NotificationQueueService } from '../notifications/notification-queue.service';
import { BlockchainService } from './blockchain.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import {
  WithdrawalCreatedResponseDto,
  WithdrawalRecordDto,
  WithdrawalRefundRequestResponseDto,
  WithdrawalsListResponseDto,
} from './dto/withdrawal-response.dto';
import { WithdrawalsQueueService } from './withdrawals-queue.service';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly authService: AuthService,
    private readonly notificationQueueService: NotificationQueueService,
    private readonly withdrawalsQueueService: WithdrawalsQueueService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async create(
    headers: Record<string, string>,
    user: UserSession['user'],
    createWithdrawalDto: CreateWithdrawalDto,
  ): Promise<WithdrawalCreatedResponseDto> {
    // 1. Basic input validation first (cheapest check)
    const amount = parseFloat(createWithdrawalDto.amount);
    ensureValid(isPositiveNumber(amount), 'Please enter a valid withdrawal amount');

    // 2. User profile checks (KYC, 2FA enabled)
    const { kycStatus, twoFactorEnabled, phoneNumberVerified, phoneNumber } =
      await this.repo.userViewsProfile({
        userId: user.id,
      });
    ensurePermission(
      kycStatus === 'verified',
      'Please complete your identity verification (KYC) first',
    );
    ensurePermission(
      phoneNumberVerified,
      'Please verify your phone number in your security settings',
    );
    ensurePermission(
      twoFactorEnabled,
      'Please enable two-factor authentication (2FA) in your security settings',
    );

    // 3. 2FA code verification (validates user intent)
    try {
      await this.authService.api.verifyTOTP({
        headers,
        body: { code: createWithdrawalDto.twoFactorCode },
      });
    } catch {
      ensureValid(false, 'Invalid 2FA code. Please check and try again');
    }
    // 3b. Phone number code verification (validates user intent)
    try {
      await this.authService.api.verifyPhoneNumber({
        headers,
        body: { phoneNumber: phoneNumber!, code: createWithdrawalDto.phoneNumberCode },
      });
    } catch {
      ensureValid(false, 'Invalid phone number code. Please check and try again');
    }

    // 4. Currency validation (check if currency exists and is supported)
    const { currencies } = await this.repo.userViewsCurrencies({
      blockchainKey: createWithdrawalDto.currencyBlockchainKey,
    });
    const currency = currencies.find(c => c.tokenId === createWithdrawalDto.currencyTokenId);
    ensureExists(currency, 'This currency is not available for withdrawal');

    // 5. Beneficiary validation (check ownership)
    const { beneficiaries } = await this.repo.userViewsWithdrawalBeneficiaries({ userId: user.id });
    const beneficiary = beneficiaries.find(b => b.id === createWithdrawalDto.beneficiaryId);
    ensureExists(beneficiary, 'Withdrawal address not found. Please add it first');

    // 6. Amount limits validation (min/max withdrawal amounts)
    const minAmount = parseFloat(currency.minWithdrawalAmount);
    const maxAmount = parseFloat(currency.maxWithdrawalAmount);
    ensureInRange(
      amount,
      minAmount,
      maxAmount,
      `Withdrawal amount must be between ${minAmount} and ${maxAmount}`,
    );

    // 7. Account balance check (ensure sufficient funds)
    const { accounts } = await this.repo.userRetrievesAccountBalances({ userId: user.id });
    const account = accounts.find(
      acc =>
        acc.currencyBlockchainKey === createWithdrawalDto.currencyBlockchainKey &&
        acc.currencyTokenId === createWithdrawalDto.currencyTokenId,
    );
    ensureExists(account, 'You do not have an account for this currency');

    const availableBalance = parseFloat(account.balance);
    ensureValid(
      availableBalance >= amount,
      `Insufficient funds. You have ${availableBalance}, but need ${amount}`,
    );

    // 8. Daily limit check (prevent exceeding daily withdrawal limits)
    const { remainingLimit } = await this.repo.userViewsRemainingDailyWithdrawalLimit({
      userId: user.id,
      currencyBlockchainKey: createWithdrawalDto.currencyBlockchainKey,
      currencyTokenId: createWithdrawalDto.currencyTokenId,
    });
    ensureValid(
      amount <= parseFloat(remainingLimit),
      `Daily withdrawal limit exceeded. You can still withdraw ${remainingLimit} today`,
    );

    // 9. Pending withdrawal check (ensure no conflicting requests)
    const { withdrawals: pendingWithdrawals } = await this.repo.userViewsWithdrawals({
      userId: user.id,
      page: 1,
      limit: 1,
      state: 'requested',
    });
    ensureUnique(
      pendingWithdrawals.length === 0,
      'You already have a pending withdrawal. Please wait for it to complete first',
    );

    // Calculate withdrawal details with fees
    const platformFee = amount * currency.withdrawalFeeRate;

    // Get estimated network fee from blockchain service
    const networkFeeEstimate = await this.blockchainService.estimateNetworkFee(
      currency.blockchainKey,
      currency.tokenId,
      { priority: 'standard' },
    );
    const estimatedNetworkFee = networkFeeEstimate.fee;

    const totalFees = platformFee + estimatedNetworkFee;
    const netAmount = amount - totalFees;

    // Ensure net amount is positive after fees
    ensureValid(
      netAmount > 0,
      `Amount is too small after fees. Please withdraw at least ${totalFees + 0.01}`,
    );

    // Create withdrawal record (triggers handle balance debit & account mutations automatically)
    const withdrawal = await this.repo.userRequestsWithdrawal({
      beneficiaryId: createWithdrawalDto.beneficiaryId,
      currencyBlockchainKey: createWithdrawalDto.currencyBlockchainKey,
      currencyTokenId: createWithdrawalDto.currencyTokenId,
      amount: createWithdrawalDto.amount,
      requestDate: new Date(),
    });

    // Queue withdrawal for blockchain processing
    await this.withdrawalsQueueService.queueWithdrawalProcessing({
      withdrawalId: withdrawal.id,
      amount: createWithdrawalDto.amount,
      currencyBlockchainKey: createWithdrawalDto.currencyBlockchainKey,
      currencyTokenId: createWithdrawalDto.currencyTokenId,
      beneficiaryAddress: beneficiary.address,
      userId: user.id,
    });

    // Send withdrawal notification
    const notificationData: SMSWithdrawalRequestedNotificationData = {
      type: 'WithdrawalRequested',
      name: 'Withdrawal Requested',
      phoneNumber: user.phoneNumber,
      amount: createWithdrawalDto.amount,
      withdrawalId: withdrawal.id,
      bankAccount: beneficiary.address,
    };
    await this.notificationQueueService.queueNotification(notificationData);

    return {
      id: withdrawal.id,
      status: withdrawal.status,
      requestAmount: createWithdrawalDto.amount,
      feeAmount: totalFees.toFixed(currency.decimals),
      netAmount: netAmount.toFixed(currency.decimals),
      currencyBlockchainKey: createWithdrawalDto.currencyBlockchainKey,
      currencyTokenId: createWithdrawalDto.currencyTokenId,
      beneficiaryId: createWithdrawalDto.beneficiaryId,
      requestDate: withdrawal.requestDate.toISOString(),
      estimatedProcessingTime: 30, // minutes
    };
  }

  async findAll(
    userId: string,
    page?: number,
    limit?: number,
    state?: 'requested' | 'sent' | 'confirmed' | 'failed',
  ): Promise<WithdrawalsListResponseDto> {
    return this.repo.userViewsWithdrawals({
      userId,
      page: page || 1,
      limit: limit || 20,
      state,
    });
  }

  async findOne(userId: string, withdrawalId: string): Promise<WithdrawalRecordDto> {
    const { withdrawal } = await this.repo.userViewsWithdrawalDetails({
      userId,
      withdrawalId,
    });

    ensureExists(withdrawal, 'Withdrawal not found');
    return withdrawal;
  }

  async refund(userId: string, withdrawalId: string): Promise<WithdrawalRefundRequestResponseDto> {
    // Check if withdrawal exists and belongs to user
    const { withdrawal } = await this.repo.userViewsWithdrawalDetails({
      userId,
      withdrawalId,
    });

    ensureExists(withdrawal, 'Withdrawal not found');

    // Cannot refund if already processed or requested
    ensureValid(
      !['RefundRequested', 'RefundApproved', 'RefundRejected'].includes(withdrawal.state),
      'A refund has already been requested for this withdrawal',
    );

    // Only failed withdrawals can be refunded
    ensureValid(withdrawal.state === 'failed', 'Only failed withdrawals are eligible for refund');

    // Update withdrawal status to refund requested
    await this.repo.platformUpdatesWithdatawalStatus({
      withdrawalId,
      status: 'RefundRequested',
      refundRequestedDate: new Date(),
    });

    return {
      message: 'Refund request submitted successfully. Admin approval required.',
      withdrawalId,
      status: 'RefundRequested',
      estimatedProcessingTime: '1-3 business days',
    };
  }
}
