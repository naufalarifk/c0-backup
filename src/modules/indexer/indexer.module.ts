import { Module } from '@nestjs/common';

import { SharedModule } from '../../shared/shared.module';
import { InvoicePaymentModule } from '../invoice-payments/invoice-payment.module';
import { ActiveInvoiceStoreService } from './active-invoice-store.service';
import { BitcoinService } from './btc.service';
import { EthereumService } from './eth.service';
import { IndexerProcessor } from './indexer.processor';
import { IndexerService } from './indexer.service';
import { MemoryStoreService } from './memory-store.service';
import { SolanaService } from './sol.service';

@Module({
  imports: [SharedModule, InvoicePaymentModule],
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
    ActiveInvoiceStoreService,
  ],
  exports: [
    IndexerService,
    IndexerProcessor,
    BitcoinService,
    EthereumService,
    SolanaService,
    MemoryStoreService,
    ActiveInvoiceStoreService,
  ],
})
export class IndexerModule {}
