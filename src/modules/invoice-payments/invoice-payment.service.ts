import { Inject, Injectable, Logger } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';

interface RecordPaymentParams {
  invoiceId: string;
  transactionHash: string;
  amount: string;
  paymentDate: Date;
}

@Injectable()
export class InvoicePaymentService {
  private readonly logger = new Logger(InvoicePaymentService.name);

  constructor(@Inject(CryptogadaiRepository) private readonly repository: CryptogadaiRepository) {}

  async recordPayment(params: RecordPaymentParams): Promise<void> {
    try {
      await this.repository.blockchainDetectsInvoicePayment({
        invoiceId: params.invoiceId,
        paymentHash: params.transactionHash,
        amount: params.amount,
        paymentDate: params.paymentDate,
      });

      this.logger.log(
        `Recorded invoice payment ${params.transactionHash} for invoice ${params.invoiceId}`,
      );
    } catch (error) {
      if (error instanceof Error && error.message.includes('duplicate key value')) {
        this.logger.warn(
          `Duplicate payment detection ignored for invoice ${params.invoiceId} hash ${params.transactionHash}`,
        );
        return;
      }

      this.logger.error(
        `Failed to record payment for invoice ${params.invoiceId} hash ${params.transactionHash}`,
        error,
      );
      throw error;
    }
  }
}
