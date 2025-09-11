import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { UserDecidesUserTypeParams } from '../../shared/types';

@Injectable()
export class UsersService {
  constructor(private readonly userRepo: CryptogadaiRepository) {}

  async setUserType(userId: string, userType: UserDecidesUserTypeParams['userType']) {
    const user = await this.userRepo.betterAuthFindOneUser([{ field: 'id', value: userId }]);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const payload: UserDecidesUserTypeParams = {
      userId,
      userType,
      decisionDate: new Date(),
    };

    await this.userRepo.userDecidesUserType(payload);

    return {
      statusCode: HttpStatus.OK,
      message: 'User type set successfully',
    };
  }
}
