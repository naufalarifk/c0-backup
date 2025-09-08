import { Module } from '@nestjs/common';

import { RepositoryModule } from '../../shared/repositories/repository.module';
import { KycController } from './kyc/kyc.controller';
import { KycService } from './kyc/kyc.service';
import { KycFileService } from './kyc/kyc-file.service';
import { ProfileModule } from './profile/profile.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [RepositoryModule, ProfileModule],
  controllers: [UsersController, KycController],
  providers: [UsersService, KycService, KycFileService],
})
export class UsersModule {}
