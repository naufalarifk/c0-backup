import { Injectable } from '@nestjs/common';

import { TelemetryLogger } from '../telemetry.logger';

export interface CgTestnetBlockchainPaymentEvent {
  blockchainKey: string;
  tokenId: string;
  address: string;
  amount: string;
  txHash: string;
  sender?: string;
  timestamp?: number;
}

type PaymentListener = (event: CgTestnetBlockchainPaymentEvent) => Promise<void>;

@Injectable()
export class CgTestnetBlockchainEventService {
  readonly logger = new TelemetryLogger(CgTestnetBlockchainEventService.name);
  #listeners = new Map<string, Set<PaymentListener>>();

  constructor() {
    this.ensureDefaultBlockchainRegistered();
  }

  registerListener(blockchainKey: string, listener: PaymentListener): () => void {
    const normalizedKey = blockchainKey.toLowerCase();
    const listeners = this.#listeners.get(normalizedKey) ?? new Set<PaymentListener>();
    listeners.add(listener);
    this.#listeners.set(normalizedKey, listeners);

    this.logger.debug('Registered test blockchain listener', { blockchainKey: normalizedKey });

    return () => {
      const existing = this.#listeners.get(normalizedKey);
      if (!existing) {
        return;
      }
      existing.delete(listener);
      if (existing.size === 0) {
        this.#listeners.delete(normalizedKey);
      }
      this.logger.debug('Unregistered test blockchain listener', { blockchainKey: normalizedKey });
    };
  }

  async dispatchPayment(rawEvent: unknown): Promise<void> {
    if (typeof rawEvent !== 'object' || rawEvent === null) {
      this.logger.error('Ignored invalid mock blockchain event payload');
      return;
    }

    const event = rawEvent as Record<string, unknown>;
    const { blockchainKey, tokenId, address, amount, txHash, sender, timestamp } = event;

    if (typeof blockchainKey !== 'string') {
      this.logger.error('Mock blockchain event missing blockchainKey');
      return;
    }
    if (typeof tokenId !== 'string') {
      this.logger.error('Mock blockchain event missing tokenId');
      return;
    }
    if (typeof address !== 'string') {
      this.logger.error('Mock blockchain event missing address');
      return;
    }
    if (typeof amount !== 'string') {
      this.logger.error('Mock blockchain event missing amount');
      return;
    }
    if (typeof txHash !== 'string') {
      this.logger.error('Mock blockchain event missing txHash');
      return;
    }

    const normalizedKey = blockchainKey.toLowerCase();
    const listeners = this.#listeners.get(normalizedKey);

    if (!listeners || listeners.size === 0) {
      this.logger.warn('No mock blockchain listeners for event', {
        blockchainKey,
        tokenId,
      });
      return;
    }

    const sanitizedEvent: CgTestnetBlockchainPaymentEvent = {
      blockchainKey: normalizedKey,
      tokenId,
      address,
      amount,
      txHash,
      sender: typeof sender === 'string' ? sender : undefined,
      timestamp: typeof timestamp === 'number' ? timestamp : undefined,
    };

    await Promise.all(Array.from(listeners).map(listener => listener(sanitizedEvent)));
  }

  ensureDefaultBlockchainRegistered(): void {
    if (!this.#listeners.has('cg:testnet')) {
      this.#listeners.set('cg:testnet', new Set());
    }
  }
}
