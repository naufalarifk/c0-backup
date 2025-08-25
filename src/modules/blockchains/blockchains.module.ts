import { Module } from '@nestjs/common';

import { BlockchainsController } from './blockchains.controller';
import { BlockchainsService } from './blockchains.service';

@Module({
  controllers: [BlockchainsController],
  providers: [BlockchainsService],
})
export class BlockchainsModule {}
