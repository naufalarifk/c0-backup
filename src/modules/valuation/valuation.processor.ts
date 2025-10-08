import type { ExchangeRateUpdatedEvent } from './valuation.types';

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';

import { Job } from 'bullmq';
import {
  assertDefined,
  assertProp,
  assertPropString,
  check,
  isInstanceOf,
  isString,
} from 'typeshaper';

import { ValuationService } from './valuation.service';
import { ValuationEventService } from './valuation-event.service';

@Processor('valuationQueue')
export class ValuationProcessor extends WorkerHost {
  private readonly logger = new Logger(ValuationProcessor.name);

  constructor(
    private readonly valuationService: ValuationService,
    private readonly valuationEventService: ValuationEventService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    switch (job.name) {
      case 'exchangeRateUpdated':
        return await this.handleExchangeRateUpdated(job);
      default:
        this.logger.warn(`Unknown job type: ${job.name}`);
        return { success: false, message: 'Unknown job type' };
    }
  }

  /**
   * Handles exchange rate updated events and recalculates loan valuations
   */
  private async handleExchangeRateUpdated(
    job: Job,
  ): Promise<{ success: boolean; processed: number }> {
    try {
      const data: unknown = job.data;
      assertDefined(data);

      // Validate event data using typeshaper
      assertPropString(data, 'exchangeRateId');
      assertPropString(data, 'priceFeedId');
      assertPropString(data, 'blockchainKey');
      assertPropString(data, 'baseCurrencyTokenId');
      assertPropString(data, 'quoteCurrencyTokenId');
      assertProp(check(isString), data, 'bidPrice');
      assertProp(check(isString), data, 'askPrice');
      assertProp(isInstanceOf(Date), data, 'retrievalDate');
      assertProp(isInstanceOf(Date), data, 'sourceDate');

      const exchangeRateEvent: ExchangeRateUpdatedEvent = {
        exchangeRateId: data.exchangeRateId,
        priceFeedId: data.priceFeedId,
        blockchainKey: data.blockchainKey,
        baseCurrencyTokenId: data.baseCurrencyTokenId,
        quoteCurrencyTokenId: data.quoteCurrencyTokenId,
        bidPrice: data.bidPrice,
        askPrice: data.askPrice,
        retrievalDate: data.retrievalDate,
        sourceDate: data.sourceDate,
      };

      this.logger.log(
        `Processing exchange rate update: ${exchangeRateEvent.baseCurrencyTokenId}/${exchangeRateEvent.quoteCurrencyTokenId}`,
      );

      // Get all active loans and process valuations
      const valuationResults =
        await this.valuationService.processValuationUpdates(exchangeRateEvent);

      // For each valuation result, check for threshold breaches and emit events
      for (const valuation of valuationResults) {
        if (valuation.breachedThresholds.length > 0) {
          // Get full loan details for event emission
          const activeLoans = await this.valuationService.getActiveLoansForValuation();
          const loan = activeLoans.find(l => l.loanId === valuation.loanId);

          if (loan) {
            await this.valuationEventService.emitLtvThresholdEvents(valuation, loan);
          }
        }
      }

      this.logger.log(
        `Successfully processed ${valuationResults.length} loan valuations for exchange rate ${exchangeRateEvent.exchangeRateId}`,
      );

      return {
        success: true,
        processed: valuationResults.length,
      };
    } catch (error) {
      this.logger.error(
        `Failed to process exchange rate update: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }
}
