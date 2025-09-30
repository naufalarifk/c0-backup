import { Injectable, Logger } from '@nestjs/common';

import { AppConfigService } from '../services/app-config.service';

interface InvoiceIdConfig {
  epochMs: number;
  workerId: number;
}

/**
 * Generates invoice identifiers that can be used before the invoice record exists.
 *
 * Format (within JavaScript safe integer range):
 *   [timestamp_since_epoch_ms][worker_id (4 bits)][sequence (12 bits)]
 *
 * - Epoch defaults to 2024-01-01T00:00:00.000Z and can be overridden with INVOICE_ID_EPOCH_MS
 * - Worker ID defaults to 0 and can be set with INVOICE_ID_WORKER_ID (range 0-15)
 * - Sequence resets every millisecond and supports up to 4096 IDs per millisecond per worker
 */
@Injectable()
export class InvoiceIdGenerator {
  private static readonly MAX_SEQUENCE = 0xfff; // 4095
  private static readonly WORKER_ID_BASE = 0x10; // 16 (4 bits)
  private static readonly SEQUENCE_BASE = 0x1000; // 4096 (12 bits)

  private readonly logger = new Logger(InvoiceIdGenerator.name);
  private readonly config: InvoiceIdConfig;

  private lastTimestamp = 0;
  private sequence = 0;

  constructor(private readonly appConfigService: AppConfigService) {
    this.config = this.resolveConfig();
  }

  generate(): number {
    let timestamp = Date.now();

    if (timestamp < this.config.epochMs) {
      this.logger.warn(
        `System clock is behind invoice epoch (${new Date(this.config.epochMs).toISOString()}). Clamping timestamp to epoch.`,
      );
      timestamp = this.config.epochMs;
    }

    if (timestamp < this.lastTimestamp) {
      this.logger.warn(
        `System clock moved backwards from ${this.lastTimestamp} to ${timestamp}. Using last timestamp to maintain monotonicity.`,
      );
      timestamp = this.lastTimestamp;
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1) & InvoiceIdGenerator.MAX_SEQUENCE;
      if (this.sequence === 0) {
        timestamp = this.waitForNextMillisecond(timestamp);
      }
    } else {
      this.sequence = 0;
    }

    this.lastTimestamp = timestamp;

    const timestampComponent = timestamp - this.config.epochMs;
    const id =
      timestampComponent * InvoiceIdGenerator.WORKER_ID_BASE * InvoiceIdGenerator.SEQUENCE_BASE +
      this.config.workerId * InvoiceIdGenerator.SEQUENCE_BASE +
      this.sequence;

    if (!Number.isSafeInteger(id)) {
      throw new Error(`Generated invoice id ${id} exceeds safe integer range`);
    }

    return id;
  }

  private waitForNextMillisecond(currentTimestamp: number): number {
    let timestamp = Date.now();
    while (timestamp <= currentTimestamp) {
      timestamp = Date.now();
    }
    return timestamp;
  }

  private resolveConfig(): InvoiceIdConfig {
    const epochMs = this.appConfigService.invoiceConfig.epochMs;
    const workerId = this.appConfigService.invoiceConfig.workerId;

    if (!Number.isFinite(epochMs) || epochMs < 0) {
      throw new Error(`Invalid INVOICE_ID_EPOCH_MS value: ${epochMs}`);
    }

    if (!Number.isInteger(workerId) || workerId < 0 || workerId > 0xf) {
      throw new Error(
        `INVOICE_ID_WORKER_ID must be an integer between 0 and 15. Received: ${workerId}`,
      );
    }

    return { epochMs, workerId };
  }
}
