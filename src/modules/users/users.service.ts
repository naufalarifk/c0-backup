import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { UserDecidesUserTypeParams } from '../../shared/types';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

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

  create(createUserDto: CreateUserDto) {
    return 'This action adds a new user';
  }

  findAll() {
    return `This action returns all users`;
  }

  findOne(id: number) {
    return `This action returns a #${id} user`;
  }

  update(id: number, updateUserDto: UpdateUserDto) {
    return `This action updates a #${id} user`;
  }

  remove(id: number) {
    return `This action removes a #${id} user`;
  }
}
