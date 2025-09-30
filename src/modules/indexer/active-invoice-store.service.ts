import type { ActiveInvoiceRecord } from '../../shared/repositories/finance.types';

import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';

interface RefreshOptions {
  blockchainKey?: string;
}

@Injectable()
export class ActiveInvoiceStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(ActiveInvoiceStoreService.name);
  private readonly store = new Map<string, Map<string, ActiveInvoiceRecord>>();
  private refreshTimer?: NodeJS.Timeout;

  constructor(@Inject(CryptogadaiRepository) private readonly repository: CryptogadaiRepository) {}

  onModuleDestroy() {
    this.stopAutoRefresh();
  }

  startAutoRefresh(intervalMs = 60_000): void {
    if (this.refreshTimer) {
      return;
    }

    this.refreshTimer = setInterval(() => {
      this.refreshAll().catch(error => {
        this.logger.error('Failed to refresh active invoice store', error);
      });
    }, intervalMs).unref();
  }

  stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = undefined;
    }
  }

  async refreshAll(): Promise<void> {
    await this.refresh();
  }

  async refresh(options: RefreshOptions = {}): Promise<void> {
    const { blockchainKey } = options;

    const invoices = await this.fetchAllActiveInvoices(blockchainKey);

    if (blockchainKey) {
      this.store.set(blockchainKey, this.buildInvoiceMap(invoices));
      this.logger.debug(
        `Refreshed ${invoices.length} active invoices for blockchain ${blockchainKey}`,
      );
      return;
    }

    const nextStore = new Map<string, Map<string, ActiveInvoiceRecord>>();

    for (const invoice of invoices) {
      const chainKey = invoice.currencyBlockchainKey;
      const chainStore = nextStore.get(chainKey) ?? new Map<string, ActiveInvoiceRecord>();
      chainStore.set(this.normalizeAddress(invoice.walletAddress), invoice);
      nextStore.set(chainKey, chainStore);
    }

    this.store.clear();
    for (const [chainKey, map] of nextStore.entries()) {
      this.store.set(chainKey, map);
    }

    this.logger.debug(`Refreshed active invoice store with ${invoices.length} invoices`);
  }

  getInvoice(blockchainKey: string, address: string): ActiveInvoiceRecord | undefined {
    const chainStore = this.store.get(blockchainKey);
    if (!chainStore) {
      return undefined;
    }

    return chainStore.get(this.normalizeAddress(address));
  }

  listInvoices(blockchainKey: string): ActiveInvoiceRecord[] {
    const chainStore = this.store.get(blockchainKey);
    if (!chainStore) {
      return [];
    }

    return Array.from(chainStore.values());
  }

  trackedBlockchains(): string[] {
    return Array.from(this.store.keys());
  }

  private buildInvoiceMap(invoices: ActiveInvoiceRecord[]): Map<string, ActiveInvoiceRecord> {
    const map = new Map<string, ActiveInvoiceRecord>();
    for (const invoice of invoices) {
      map.set(this.normalizeAddress(invoice.walletAddress), invoice);
    }
    return map;
  }

  private normalizeAddress(address: string): string {
    return address.toLowerCase();
  }

  private async fetchAllActiveInvoices(blockchainKey?: string): Promise<ActiveInvoiceRecord[]> {
    const pageSize = 500;
    let offset = 0;
    const invoices: ActiveInvoiceRecord[] = [];

    while (true) {
      const batch = await this.repository.platformViewsActiveInvoices({
        blockchainKey,
        limit: pageSize,
        offset,
      });

      invoices.push(...batch);

      if (batch.length < pageSize) {
        break;
      }

      offset += batch.length;
    }

    return invoices;
  }
}
