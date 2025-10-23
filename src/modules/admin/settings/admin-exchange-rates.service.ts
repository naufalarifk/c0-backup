import type { Queue } from 'bullmq';
import type { PriceFeedStoreEvent } from '../../pricefeed/pricefeed-provider.types';

import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, NotFoundException } from '@nestjs/common';

import { assertDefined, assertProp, assertPropString, check, isNumber, isString } from 'typeshaper';

import { CryptogadaiRepository } from '../../../shared/repositories/cryptogadai.repository';
import { TelemetryLogger } from '../../../shared/telemetry.logger';
import { ManualExchangeRateFeedDto } from './dto/admin-exchange-rates.dto';

@Injectable()
export class AdminExchangeRatesService {
  private readonly logger = new TelemetryLogger(AdminExchangeRatesService.name);

  constructor(
    private readonly repository: CryptogadaiRepository,
    @InjectQueue('pricefeedQueue')
    private readonly pricefeedQueue: Queue,
  ) {}

  async feedExchangeRate(dto: ManualExchangeRateFeedDto) {
    const { priceFeedId, bidPrice, askPrice, sourceDate, retrievalDate } = dto;

    // Retrieve price feed information from database
    const rows = await this.repository.sql`
      SELECT
        pf.id,
        pf.blockchain_key,
        pf.base_currency_token_id,
        pf.quote_currency_token_id,
        pf.source
      FROM price_feeds pf
      WHERE pf.id = ${priceFeedId}
    `;

    if (rows.length === 0) {
      throw new NotFoundException(`Price feed with ID ${priceFeedId} not found`);
    }

    const priceFeed: unknown = rows[0];
    assertDefined(priceFeed, 'Price feed is undefined');
    assertProp(check(isString, isNumber), priceFeed, 'id');
    assertPropString(priceFeed, 'blockchain_key');
    assertPropString(priceFeed, 'base_currency_token_id');
    assertPropString(priceFeed, 'quote_currency_token_id');
    assertPropString(priceFeed, 'source');

    const now = new Date();
    const finalSourceDate = sourceDate ? new Date(sourceDate) : now;
    const finalRetrievalDate = retrievalDate ? new Date(retrievalDate) : now;

    // Create price feed store event
    const event: PriceFeedStoreEvent = {
      priceFeedId: String(priceFeed.id),
      blockchainKey: priceFeed.blockchain_key,
      baseCurrencyTokenId: priceFeed.base_currency_token_id,
      quoteCurrencyTokenId: priceFeed.quote_currency_token_id,
      bidPrice,
      askPrice,
      retrievalDate: finalRetrievalDate,
      sourceDate: finalSourceDate,
    };

    // Dispatch to pricefeed queue
    await this.pricefeedQueue.add('storePriceFeed', event, {
      priority: 1,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
    });

    this.logger.log('Admin manually fed exchange rate', {
      priceFeedId,
      blockchainKey: priceFeed.blockchain_key,
      baseCurrencyTokenId: priceFeed.base_currency_token_id,
      quoteCurrencyTokenId: priceFeed.quote_currency_token_id,
      bidPrice,
      askPrice,
    });

    return {
      message: 'Exchange rate feed dispatched successfully',
      priceFeedId: String(priceFeed.id),
      blockchainKey: priceFeed.blockchain_key,
      baseCurrencyTokenId: priceFeed.base_currency_token_id,
      quoteCurrencyTokenId: priceFeed.quote_currency_token_id,
      bidPrice,
      askPrice,
      sourceDate: finalSourceDate.toISOString(),
      retrievalDate: finalRetrievalDate.toISOString(),
    };
  }
}
