import { Injectable } from '@nestjs/common';

import { twoFactor } from 'better-auth/plugins';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { ensurePrecondition } from '../../shared/utils';
import { AuthService } from '../auth/auth.service';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalDto } from './dto/update-withdrawal.dto';

type TwoFactor = ReturnType<typeof twoFactor>['endpoints'];

@Injectable()
export class WithdrawalsService {
  constructor(
    private readonly repo: CryptogadaiRepository,
    private readonly authService: AuthService,
  ) {}

  async create(headers: HeadersInit, userId: string, createWithdrawalDto: CreateWithdrawalDto) {
    // Verify user has completed KYC and enabled 2FA
    const { kycStatus, twoFactorEnabled } = await this.repo.userViewsProfile({ userId });
    ensurePrecondition(
      kycStatus === 'verified',
      'KYC must be verified before adding a withdrawal address',
    );

    ensurePrecondition(
      twoFactorEnabled,
      'Two-factor authentication must be enabled before adding a withdrawal address',
    );

    const verifyTOTP = await this.authService.api.verifyTOTP({
      headers,
      body: { code: createWithdrawalDto.twoFactorCode },
    });

    console.log('verifyTOTP :>> ', verifyTOTP);

    const payload: Parameters<typeof this.repo.userRequestsWithdrawal>[0] = {
      /** @TODO */
      currencyBlockchainKey: 'TODO',
      currencyTokenId: 'TODO',
      beneficiaryId: createWithdrawalDto.beneficiaryId,
      amount: createWithdrawalDto.amount,
      requestDate: new Date(),
    };

    // await this.repo.userRequestsWithdrawal(payload);

    return payload;
  }

  findAll() {
    this.repo.userViewsWithdrawalBeneficiaries({ userId: 'userId' });
    return `This action returns all withdrawals`;
  }

  findOne(id: number) {
    return `This action returns a #${id} withdrawal`;
  }

  refund(id: number, updateWithdrawalDto: UpdateWithdrawalDto) {
    return `This action updates a #${id} withdrawal`;
  }
}
