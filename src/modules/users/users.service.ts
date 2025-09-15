import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { UserDecidesUserTypeParams } from '../../shared/types';
import { ensureExists, ResponseHelper } from '../../shared/utils';

@Injectable()
export class UsersService {
  constructor(private readonly repo: CryptogadaiRepository) {}

  async setUserType(userId: string, userType: UserDecidesUserTypeParams['userType']) {
    const user = await this.repo.betterAuthFindOneUser([{ field: 'id', value: userId }]);
    ensureExists(user, 'User not found');

    const payload: UserDecidesUserTypeParams = {
      userId,
      userType,
      decisionDate: new Date(),
    };

    await this.repo.userDecidesUserType(payload);

    return ResponseHelper.action('User type set', {
      userType: payload.userType,
    });
  }
}
