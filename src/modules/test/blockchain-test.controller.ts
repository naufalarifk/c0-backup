import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { assertDefined, assertProp, check, isNumber, isString } from 'typeshaper';

import { Auth } from '../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { CgTestnetBlockchainEventService } from '../../shared/services/cg-testnet-blockchain-event.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';

@Controller('test')
@Auth({ public: true })
export class BlockchainTestController {
  #logger = new TelemetryLogger(BlockchainTestController.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly repo: CryptogadaiRepository,
    private readonly testBlockchainEvents: CgTestnetBlockchainEventService,
  ) {}

  @Post('cg-testnet-blockchain-payments')
  async dispatchMockBlockchainPayment(
    @Body()
    body: {
      blockchainKey?: string;
      tokenId?: string;
      address?: string;
      amount?: string;
      txHash?: string;
      sender?: string;
      timestamp?: string | number;
    },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    if (!body || typeof body !== 'object') {
      throw new BadRequestException('request body is required');
    }

    const blockchainKey =
      typeof body.blockchainKey === 'string' && body.blockchainKey.trim().length > 0
        ? body.blockchainKey
        : 'cg:testnet';

    if (!body.tokenId || typeof body.tokenId !== 'string') {
      throw new BadRequestException('tokenId is required');
    }
    if (!body.address || typeof body.address !== 'string') {
      throw new BadRequestException('address is required');
    }
    if (!body.amount || typeof body.amount !== 'string') {
      throw new BadRequestException('amount is required');
    }
    if (!body.txHash || typeof body.txHash !== 'string') {
      throw new BadRequestException('txHash is required');
    }

    let timestamp: number | undefined;
    if (body.timestamp !== undefined) {
      if (typeof body.timestamp === 'number' && Number.isFinite(body.timestamp)) {
        timestamp = Math.floor(body.timestamp);
      } else if (typeof body.timestamp === 'string') {
        const parsed = Date.parse(body.timestamp);
        if (Number.isNaN(parsed)) {
          throw new BadRequestException(
            'timestamp must be a valid ISO date string or epoch seconds',
          );
        }
        timestamp = Math.floor(parsed / 1000);
      } else {
        throw new BadRequestException('timestamp must be a number or ISO date string');
      }
    }

    const invoiceRows = await this.repo.sql`
			SELECT inv.invoiced_amount, c.decimals
			FROM invoices inv
			JOIN currencies c ON c.blockchain_key = inv.currency_blockchain_key AND c.token_id = inv.currency_token_id
			WHERE inv.wallet_address = ${body.address}
			ORDER BY inv.id DESC
			LIMIT 1
		`;

    let finalAmount = body.amount;
    if (invoiceRows.length > 0) {
      const invoice = invoiceRows[0];
      assertDefined(invoice);
      assertProp(check(isString, isNumber), invoice, 'invoiced_amount');
      assertProp(check(isNumber), invoice, 'decimals');

      const invoicedAmount = String(invoice.invoiced_amount);
      const decimals = Number(invoice.decimals);

      if (!body.amount.includes('.')) {
        const amountNum = BigInt(body.amount);
        const invoicedAmountNum = BigInt(invoicedAmount);

        if (amountNum * BigInt(1000) < invoicedAmountNum) {
          finalAmount = (amountNum * BigInt(10) ** BigInt(decimals)).toString();
          this.#logger.debug('Converted payment amount to smallest units', {
            originalAmount: body.amount,
            convertedAmount: finalAmount,
            decimals,
          });
        }
      }
    }

    await this.testBlockchainEvents.dispatchPayment({
      blockchainKey: blockchainKey.toLowerCase(),
      tokenId: body.tokenId,
      address: body.address,
      amount: finalAmount,
      txHash: body.txHash,
      sender:
        typeof body.sender === 'string' && body.sender.trim().length > 0 ? body.sender : undefined,
      timestamp,
    });

    this.#logger.debug('Dispatched cg:testnet blockchain payment event', {
      blockchainKey,
      tokenId: body.tokenId,
      address: body.address,
      txHash: body.txHash,
      amount: finalAmount,
    });

    return {
      success: true,
      blockchainKey,
      tokenId: body.tokenId,
      address: body.address,
      amount: finalAmount,
      txHash: body.txHash,
      timestamp,
    };
  }
}
