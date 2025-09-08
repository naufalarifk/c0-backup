import { Injectable } from '@nestjs/common';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../telemetry.logger';
import { CreateProfileDto } from './dto/create-profile.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class ProfileService {
  private readonly logger = new TelemetryLogger(ProfileService.name);

  constructor(private readonly userRepo: CryptogadaiRepository) {}

  create(createProfileDto: CreateProfileDto) {
    return 'This action adds a new profile';
  }

  findAll() {
    return `This action returns all profile`;
  }

  findOne(userId: string) {
    return this.userRepo.userViewsProfile({ userId });
  }

  update(userId: string, updateProfileDto: UpdateProfileDto) {
    const profileData = {
      ...updateProfileDto,
      id: userId,
      updateDate: new Date(), // Server-generated timestamp, not exposed in API contract
    };

    const result = this.userRepo.userUpdatesProfile(profileData);

    // Log successful update
    this.logger.log(`Profile updated successfully for user ${userId}`);

    return result;
  }

  remove(id: number) {
    return `This action removes a #${id} profile`;
  }
}
