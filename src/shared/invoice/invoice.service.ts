import { Injectable, Logger } from '@nestjs/common';

import { WalletService } from '../wallets/wallet.service';
import {
  IInvoiceService,
  InvoiceCreateParams,
  InvoiceError,
  InvoicePreparationResult,
} from './invoice.types';
import { InvoiceIdGenerator } from './invoice-id.generator';

@Injectable()
export class InvoiceService implements IInvoiceService {
  private readonly logger = new Logger(InvoiceService.name);

  constructor(
    private readonly platformWalletService: WalletService,
    private readonly invoiceIdGenerator: InvoiceIdGenerator,
  ) {}

  async prepareInvoice(params: InvoiceCreateParams): Promise<InvoicePreparationResult> {
    this.logger.debug(
      `Preparing invoice for user ${params.userId} on ${params.currencyBlockchainKey}:${params.currencyTokenId}`,
    );

    const prepaidAmount = params.prepaidAmount ?? '0';
    const payableAmount = this.calculatePayableAmount(params.invoicedAmount, prepaidAmount);
    const accountBlockchainKey = params.accountBlockchainKey ?? params.currencyBlockchainKey;
    const accountTokenId = params.accountTokenId ?? params.currencyTokenId;

    const invoiceId = this.invoiceIdGenerator.generate();
    const { address, derivationPath } = await this.platformWalletService.deriveInvoiceWallet(
      params.currencyBlockchainKey,
      invoiceId,
    );

    const invoiceDate = params.invoiceDate;
    const dueDate = params.dueDate ?? params.expiredDate ?? invoiceDate;
    const expiredDate = params.expiredDate ?? dueDate;

    return {
      ...params,
      accountBlockchainKey,
      accountTokenId,
      prepaidAmount,
      payableAmount,
      invoiceId,
      walletAddress: address,
      walletDerivationPath: derivationPath,
      invoiceDate,
      dueDate,
      expiredDate,
    };
  }

  private calculatePayableAmount(invoicedAmount: string, prepaidAmount: string): string {
    const invoiceTotal = this.parseAmount(invoicedAmount, 'invoicedAmount');
    const prepaid = this.parseAmount(prepaidAmount, 'prepaidAmount');

    if (prepaid < 0) {
      throw new InvoiceError('Prepaid amount cannot be negative');
    }

    if (prepaid > invoiceTotal) {
      throw new InvoiceError('Prepaid amount cannot exceed invoiced amount');
    }

    return (invoiceTotal - prepaid).toString();
  }

  private parseAmount(amount: string, field: string): bigint {
    try {
      return BigInt(amount);
    } catch (error) {
      throw new InvoiceError(`Invalid ${field} value: ${amount}`, {
        cause: error instanceof Error ? error : undefined,
      });
    }
  }
}
