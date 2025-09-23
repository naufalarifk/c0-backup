import { Module } from '@nestjs/common';

import { BitcoinService } from './btc.service';
import { EthereumService } from './eth.service';
import { IndexerProcessor } from './indexer.processor';
import { IndexerService } from './indexer.service';
import { MemoryStoreService } from './memory-store.service';
import { SolanaService } from './sol.service';

@Module({
  providers: [
    // Core indexer service
    IndexerService,

    // Indexer processor for worker mode
    IndexerProcessor,

    // Blockchain services
    BitcoinService,
    EthereumService,
    SolanaService,

    // Storage service
    MemoryStoreService,
  ],
  exports: [
    IndexerService,
    IndexerProcessor,
    BitcoinService,
    EthereumService,
    SolanaService,
    MemoryStoreService,
  ],
})
export class IndexerModule {}
