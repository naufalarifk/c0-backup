import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { BalanceCollectorFactory } from './balance-collector.factory';
import { BitcoinBalanceCollector } from './collectors/bitcoin-balance.collector';
import { BSCBalanceCollector } from './collectors/bsc-balance.collector';
import { EVMBalanceCollector } from './collectors/evm-balance.collector';
import { SepoliaBalanceCollector } from './collectors/sepolia-balance.collector';
import { SolanaBalanceCollector } from './collectors/solana-balance.collector';
import { WalletBalanceCollectorProcessor } from './wallet-balance-collector.processor';
import { WalletBalanceCollectorQueueService } from './wallet-balance-collector.queue.service';
import { WalletBalanceCollectorService } from './wallet-balance-collector.service';

@Module({
  imports: [
    SharedModule,
    BullModule.registerQueue({
      name: 'walletBalanceCollectorQueue',
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 20,
      },
    }),
  ],
  providers: [
    // Core services
    WalletBalanceCollectorService,
    WalletBalanceCollectorQueueService,
    WalletBalanceCollectorProcessor,
    BalanceCollectorFactory,
    // Blockchain-specific collectors
    EVMBalanceCollector,
    BSCBalanceCollector,
    SepoliaBalanceCollector,
    SolanaBalanceCollector,
    BitcoinBalanceCollector,
  ],
  exports: [WalletBalanceCollectorService, WalletBalanceCollectorQueueService],
})
export class WalletBalanceCollectorModule {}
