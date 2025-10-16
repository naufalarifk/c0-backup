import { BadRequestException, Body, Controller, NotFoundException, Post } from '@nestjs/common';

import { assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { Auth } from '../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../shared/telemetry.logger';

@Controller('test')
@Auth({ public: true })
export class WithdrawalTestController {
  #logger = new TelemetryLogger(WithdrawalTestController.name);

  constructor(private readonly repo: CryptogadaiRepository) {}

  @Post('create-beneficiary-by-email')
  async createBeneficiaryByEmail(
    @Body()
    body: { email: string; blockchainKey: string; address: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, blockchainKey, address } = body;

    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!blockchainKey || typeof blockchainKey !== 'string') {
      throw new BadRequestException('blockchainKey is required');
    }
    if (!address || typeof address !== 'string') {
      throw new BadRequestException('address is required');
    }

    const userRows = await this.repo.sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (userRows.length === 0) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const user = userRows[0];
    assertDefined(user);
    assertProp(check(isString, isNumber), user, 'id');
    const userId = String(user.id);

    // Insert beneficiary
    const beneficiaryRows = await this.repo.sql`
      INSERT INTO beneficiaries (
        user_id,
        blockchain_key,
        address
      )
      VALUES (
        ${userId},
        ${blockchainKey},
        ${address}
      )
      RETURNING id
    `;

    const beneficiary = beneficiaryRows[0];
    assertDefined(beneficiary);
    assertProp(check(isString, isNumber), beneficiary, 'id');
    const beneficiaryId = String(beneficiary.id);

    this.#logger.debug(
      `Created beneficiary ${beneficiaryId} for user ${email} at ${address} on ${blockchainKey}`,
    );

    return {
      success: true,
      message: `Beneficiary created for ${email}`,
      beneficiaryId,
      userId: Number(userId),
      address,
      blockchainKey,
    };
  }

  @Post('create-withdrawal-by-email')
  async createWithdrawalByEmail(
    @Body()
    body: {
      email: string;
      beneficiaryId: string;
      amount: string;
      currencyBlockchainKey?: string;
      currencyTokenId?: string;
    },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { email, beneficiaryId, amount, currencyBlockchainKey, currencyTokenId } = body;

    if (!email || typeof email !== 'string') {
      throw new BadRequestException('email is required');
    }
    if (!beneficiaryId || typeof beneficiaryId !== 'string') {
      throw new BadRequestException('beneficiaryId is required');
    }
    if (!amount || typeof amount !== 'string') {
      throw new BadRequestException('amount is required');
    }

    const userRows = await this.repo.sql`
      SELECT id FROM users WHERE email = ${email}
    `;

    if (userRows.length === 0) {
      throw new NotFoundException(`User with email ${email} not found`);
    }

    const user = userRows[0];
    assertDefined(user);
    assertProp(check(isString, isNumber), user, 'id');
    const userId = String(user.id);

    // Get beneficiary to determine currency if not provided
    const beneficiaryRows = await this.repo.sql`
      SELECT blockchain_key FROM beneficiaries WHERE id = ${beneficiaryId}
    `;

    if (beneficiaryRows.length === 0) {
      throw new NotFoundException(`Beneficiary with id ${beneficiaryId} not found`);
    }

    const beneficiary = beneficiaryRows[0];
    assertDefined(beneficiary);
    assertProp(check(isString), beneficiary, 'blockchain_key');

    const effectiveCurrencyBlockchainKey = currencyBlockchainKey || beneficiary.blockchain_key;
    const effectiveCurrencyTokenId = currencyTokenId || 'slip44:714'; // Default to BNB

    // Insert withdrawal
    const withdrawalRows = await this.repo.sql`
      INSERT INTO withdrawals (
        currency_blockchain_key,
        currency_token_id,
        beneficiary_id,
        amount,
        request_date,
        request_amount,
        status
      )
      VALUES (
        ${effectiveCurrencyBlockchainKey},
        ${effectiveCurrencyTokenId},
        ${beneficiaryId},
        ${amount},
        NOW(),
        ${amount},
        'Requested'
      )
      RETURNING id
    `;

    const withdrawal = withdrawalRows[0];
    assertDefined(withdrawal);
    assertProp(check(isString, isNumber), withdrawal, 'id');
    const withdrawalId = String(withdrawal.id);

    this.#logger.debug(
      `Created withdrawal ${withdrawalId} for user ${email}: ${amount} ${effectiveCurrencyTokenId}`,
    );

    return {
      success: true,
      message: `Withdrawal created for ${email}`,
      withdrawalId: Number(withdrawalId),
      userId: Number(userId),
      amount,
      currency: {
        blockchainKey: effectiveCurrencyBlockchainKey,
        tokenId: effectiveCurrencyTokenId,
      },
    };
  }

  @Post('mark-withdrawal-as-failed')
  async markWithdrawalAsFailed(
    @Body()
    body: { withdrawalId: number; failureReason?: string },
  ) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test endpoints are not available in production');
    }

    const { withdrawalId, failureReason = 'Test failure for E2E testing' } = body;

    if (!withdrawalId || typeof withdrawalId !== 'number') {
      throw new BadRequestException('withdrawalId is required');
    }

    await this.repo.sql`
      UPDATE withdrawals
      SET status = 'Failed',
          failed_date = NOW(),
          failure_reason = ${failureReason}
      WHERE id = ${withdrawalId}
    `;

    this.#logger.debug(`Marked withdrawal ${withdrawalId} as failed: ${failureReason}`);

    return {
      success: true,
      message: `Withdrawal ${withdrawalId} marked as failed`,
      withdrawalId,
      failureReason,
    };
  }
}
