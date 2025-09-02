import { Module } from '@nestjs/common';

import { RepositoryModule } from '../../shared/repositories/repository.module';
import { UserRepository } from '../../shared/repositories/user.repository';
import { KycController } from './kyc/kyc.controller';
import { KycService } from './kyc/kyc.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [RepositoryModule],
  controllers: [UsersController, KycController],
  providers: [UsersService, KycService],
})
export class UsersModule {}
