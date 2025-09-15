import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { ensurePrecondition } from '../../shared/utils';
import { CreateWithdrawalDto } from './dto/create-withdrawal.dto';
import { UpdateWithdrawalDto } from './dto/update-withdrawal.dto';

@Injectable()
export class WithdrawalsService {
  constructor(private readonly repo: CryptogadaiRepository) {}

  async create(userId: string, createWithdrawalDto: CreateWithdrawalDto) {
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

    return 'This action adds a new withdrawal';
  }

  findAll() {
    return `This action returns all withdrawals`;
  }

  findOne(id: number) {
    return `This action returns a #${id} withdrawal`;
  }

  refund(id: number, updateWithdrawalDto: UpdateWithdrawalDto) {
    return `This action updates a #${id} withdrawal`;
  }
}
