import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { SharedModule } from '../../shared/shared.module';
import { InvoicePaymentModule } from '../invoice-payments/invoice-payment.module';
import { IndexerEventService } from './indexer-event.service';
import { BitcoinMainnetIndexerListener } from './listeners/bitcoin-mainnet.listener';
import { BscMainnetIndexerListener } from './listeners/bsc-mainnet.listener';
import { CgTestnetIndexerListener } from './listeners/cg-testnet.listener';
import { EthereumHoodiIndexerListener } from './listeners/ethereum-hoodi.listener';
import { EthereumMainnetIndexerListener } from './listeners/ethereum-mainnet.listener';
import { SolanaMainnetIndexerListener } from './listeners/solana-mainnet.listener';

@Module({
  imports: [SharedModule, InvoicePaymentModule, DiscoveryModule],
  providers: [
    IndexerEventService,

    // Indexer Listeners
    BitcoinMainnetIndexerListener,
    BscMainnetIndexerListener,
    CgTestnetIndexerListener,
    EthereumHoodiIndexerListener,
    EthereumMainnetIndexerListener,
    SolanaMainnetIndexerListener,
  ],
  exports: [IndexerEventService],
})
export class IndexerModule {}
