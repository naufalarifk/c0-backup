import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { defaultPricefeedConfig } from './pricefeed.config';
import { PricefeedService } from './pricefeed.service';

@Injectable()
export class PricefeedScheduler implements OnModuleInit {
  private readonly logger = new TelemetryLogger(PricefeedScheduler.name);

  constructor(
    private readonly pricefeedService: PricefeedService,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit() {
    const isEnabled = this.configService.get<boolean>(
      'PRICEFEED_SCHEDULER_ENABLED',
      defaultPricefeedConfig.schedulerEnabled,
    );

    if (!isEnabled) {
      this.logger.debug('Price feed scheduler is disabled, skipping initial fetch');
      return;
    }

    this.logger.log('Running initial price feed fetch on module init');
    // Run async without blocking module initialization
    // Errors in price feed fetching should not prevent app startup
    this.pricefeedService
      .fetchAndStorePrices()
      .then(() => {
        this.logger.log('Initial price feed fetch completed successfully');
      })
      .catch(error => {
        this.logger.error('Initial price feed fetch failed:', error);
      });
  }

  @Cron(CronExpression.EVERY_5_MINUTES)
  async handlePriceFeedCron() {
    const isEnabled = this.configService.get<boolean>(
      'PRICEFEED_SCHEDULER_ENABLED',
      defaultPricefeedConfig.schedulerEnabled,
    );

    if (!isEnabled) {
      this.logger.debug('Price feed scheduler is disabled');
      return;
    }

    this.logger.log('Starting scheduled price feed fetch');

    try {
      await this.pricefeedService.fetchAndStorePrices();
      this.logger.log('Scheduled price feed fetch completed successfully');
    } catch (error) {
      this.logger.error('Scheduled price feed fetch failed:', error);
    }
  }
}
