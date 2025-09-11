import { Module } from '@nestjs/common';
import { RouterModule } from '@nestjs/core';

import { KycController } from './kyc/kyc.controller';
import { KycModule } from './kyc/kyc.module';
import { KycService } from './kyc/kyc.service';
import { ProfileModule } from './profile/profile.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    ProfileModule,
    KycModule,
    RouterModule.register([
      {
        path: 'users',
        module: UsersModule,
        children: [
          {
            path: 'profile',
            module: ProfileModule,
          },
          {
            path: 'kyc',
            module: KycModule,
          },
        ],
      },
    ]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
