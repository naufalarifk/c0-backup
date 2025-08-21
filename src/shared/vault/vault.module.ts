import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { VaultService } from './vault.service';
import { VaultController } from './vault.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [VaultController],
  providers: [VaultService],
  exports: [VaultService],
})
export class VaultModule {}