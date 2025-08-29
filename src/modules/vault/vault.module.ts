import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [VaultController],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}
