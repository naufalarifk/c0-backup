import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { defaultPricefeedConfig } from './pricefeed.config';
import { PricefeedService } from './pricefeed.service';

@Injectable()
export class PricefeedScheduler {
  private readonly logger = new Logger(PricefeedScheduler.name);

  constructor(
    private readonly pricefeedService: PricefeedService,
    private readonly configService: ConfigService,
  ) {}

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
