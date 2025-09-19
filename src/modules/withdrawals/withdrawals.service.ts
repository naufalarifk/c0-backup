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
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import {
  WithdrawalCreatedResponseDto,
  WithdrawalRecordDto,
  WithdrawalRefundRequestResponseDto,
  WithdrawalsListResponseDto,
} from './dto/withdrawal-response.dto';

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly authService: AuthService,
  ) {}

  async create(
    headers: HeadersInit,
    userId: string,
    createWithdrawalDto: CreateWithdrawalDto,
  ): Promise<WithdrawalCreatedResponseDto> {
    // Verify user has completed KYC and enabled 2FA
    const { kycStatus, twoFactorEnabled } = await this.repo.userViewsProfile({ userId });
    ensurePermission(
      kycStatus === 'verified',
      'KYC must be verified before creating withdrawal request',
    );

    ensurePermission(
      twoFactorEnabled,
      'Two-factor authentication must be enabled before creating withdrawal request',
    );

    // Verify 2FA code
    const verifyTOTP = await this.authService.api.verifyTOTP({
      headers,
      body: { code: createWithdrawalDto.twoFactorCode },
    });

    ensureValid(verifyTOTP?.user, 'Invalid 2FA code');

    // Verify beneficiary belongs to user and is on the same blockchain as currency
    const { beneficiaries } = await this.repo.userViewsWithdrawalBeneficiaries({ userId });
    const beneficiary = beneficiaries.find(b => b.id === createWithdrawalDto.beneficiaryId);
    ensureExists(beneficiary, 'Beneficiary not found or does not belong to user');

    ensureValid(
      beneficiary.blockchainKey === createWithdrawalDto.currencyBlockchainKey,
      'Beneficiary blockchain must match currency blockchain',
    );

    // Get withdrawal limits from currencies table
    const { currencies } = await this.repo.userViewsCurrencies({
      blockchainKey: createWithdrawalDto.currencyBlockchainKey,
    });

    const currency = currencies.find(c => c.tokenId === createWithdrawalDto.currencyTokenId);
    ensureExists(currency, 'Currency not found or not supported for withdrawal');

    // Validate amount against limits
    const amount = parseFloat(createWithdrawalDto.amount);
    ensureValid(isPositiveNumber(amount), 'Withdrawal amount must be a positive number');

    const minAmount = parseFloat(currency.minWithdrawalAmount);
    const maxAmount = parseFloat(currency.maxWithdrawalAmount);

    ensureInRange(
      amount,
      minAmount,
      maxAmount,
      `Withdrawal amount must be between ${minAmount} and ${maxAmount}`,
    );

    // Check daily withdrawal limit
    const { remainingLimit } = await this.repo.getRemainingDailyWithdrawalLimit({
      userId,
      currencyBlockchainKey: createWithdrawalDto.currencyBlockchainKey,
      currencyTokenId: createWithdrawalDto.currencyTokenId,
    });

    ensureValid(
      amount <= parseFloat(remainingLimit),
      `Daily withdrawal limit exceeded. Remaining: ${remainingLimit}`,
    );

    // Validate no conflicting pending withdrawal requests
    const { withdrawals: pendingWithdrawals } = await this.repo.userViewsWithdrawals({
      userId,
      page: 1,
      limit: 1,
      state: 'requested',
    });

    ensureUnique(
      pendingWithdrawals.length === 0,
      'You have a pending withdrawal request. Please wait for it to be processed before creating a new one',
    );

    // Check sufficient account balance for the specified currency
    const { accounts } = await this.repo.userRetrievesAccountBalances({ userId });
    const account = accounts.find(
      acc =>
        acc.currencyBlockchainKey === createWithdrawalDto.currencyBlockchainKey &&
        acc.currencyTokenId === createWithdrawalDto.currencyTokenId,
    );
    ensureExists(account, 'Account not found for the specified currency');

    const availableBalance = parseFloat(account.balance);
    ensureValid(
      availableBalance >= amount,
      `Insufficient balance. Available: ${availableBalance}, Required: ${amount}`,
    );

    // Calculate withdrawal details with fees
    // TODO: Integrate with BlockchainService for network fee estimation
    // const networkFee = await this.blockchainService.estimateNetworkFee({
    //   blockchain: createWithdrawalDto.currencyBlockchainKey,
    //   tokenId: createWithdrawalDto.currencyTokenId
    // });

    const platformFee = amount * currency.withdrawalFeeRate;
    const estimatedNetworkFee = 0; // TODO: Get from BlockchainService
    const totalFees = platformFee + estimatedNetworkFee;
    const netAmount = amount - totalFees;

    // Ensure net amount is positive after fees
    ensureValid(
      netAmount > 0,
      `Amount too small to cover fees. Minimum amount needed: ${totalFees + 0.01}`,
    );

    // Begin atomic database transaction
    // TODO: Implement proper transaction atomicity with FinanceRepository
    // const tx = await this.repo.beginTransaction();
    // try {

    // 1. Create withdrawal record
    const withdrawal = await this.repo.userRequestsWithdrawal({
      beneficiaryId: createWithdrawalDto.beneficiaryId,
      currencyBlockchainKey: createWithdrawalDto.currencyBlockchainKey,
      currencyTokenId: createWithdrawalDto.currencyTokenId,
      amount: createWithdrawalDto.amount,
      requestDate: new Date(),
    });

    // 2. Create account mutation record and debit user account balance
    // TODO: Implement account mutation - need repository method
    // await this.repo.platformCreatesAccountMutation({
    //   userId,
    //   accountId: account.id,
    //   mutationType: 'WithdrawalRequested',
    //   amount: `-${createWithdrawalDto.amount}`, // Debit
    //   withdrawalId: withdrawal.id,
    //   mutationDate: new Date()
    // });

    // 3. Update user withdrawal limits tracking
    // TODO: Implement withdrawal limits tracking update
    // await this.repo.updateUserWithdrawalLimitsTracking({
    //   userId,
    //   currencyBlockchainKey: createWithdrawalDto.currencyBlockchainKey,
    //   currencyTokenId: createWithdrawalDto.currencyTokenId,
    //   amount: createWithdrawalDto.amount
    // });

    // 4. Create withdrawal request notification
    // TODO: Implement notification system
    // await this.notificationService.createWithdrawalRequestNotification({
    //   userId,
    //   withdrawalId: withdrawal.id,
    //   amount: createWithdrawalDto.amount
    // });

    // 5. Commit database transaction
    // await tx.commitTransaction();

    // 6. Queue withdrawal for processing via BlockchainService
    // TODO: Implement queue system
    // await this.blockchainService.queueWithdrawalForProcessing(withdrawal.id);

    return {
      id: withdrawal.id,
      status: 'Requested',
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

    ensureExists(withdrawal, 'Withdrawal request not found');
    return withdrawal;
  }

  async refund(userId: string, withdrawalId: string): Promise<WithdrawalRefundRequestResponseDto> {
    // Check if withdrawal exists and belongs to user
    const { withdrawal } = await this.repo.userViewsWithdrawalDetails({
      userId,
      withdrawalId,
    });

    ensureExists(withdrawal, 'Withdrawal request not found');

    // Cannot refund if already processed or requested
    ensureValid(
      !['RefundRequested', 'RefundApproved', 'RefundRejected'].includes(withdrawal.state),
      'Refund has already been requested or processed for this withdrawal',
    );

    // Only failed withdrawals can be refunded
    ensureValid(withdrawal.state === 'failed', 'Only failed withdrawals can be refunded');

    // Update withdrawal status to refund requested
    await this.repo.updateWithdrawalStatus({
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
