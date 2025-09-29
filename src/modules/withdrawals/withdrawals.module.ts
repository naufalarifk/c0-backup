import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { CryptographyModule } from '../../shared/cryptography/cryptography.module';
import { WalletFactory } from '../../shared/wallets/Iwallet.types';
import { AdminWithdrawalModule } from '../admin/withdrawals/admin-withdrawal.module';
import { NotificationModule } from '../notifications/notification.module';
import { BlockchainService } from './blockchain.service';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsProcessor } from './withdrawals.processor';
import { WithdrawalsService } from './withdrawals.service';
import { WithdrawalsQueueService } from './withdrawals-queue.service';

@Module({
  imports: [
    NotificationModule,
    AdminWithdrawalModule,
    CryptographyModule,
    BullModule.registerQueue({
      name: 'withdrawalsQueue',
    }),
  ],
  controllers: [WithdrawalsController],
  providers: [
    WithdrawalsService,
    WithdrawalsQueueService,
    WithdrawalsProcessor,
    BlockchainService,
    WalletFactory,
  ],
})
export class WithdrawalsModule {}
