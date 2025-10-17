import { BadRequestException, Body, Controller, Post } from '@nestjs/common';

import { Auth } from '../../decorators/auth.decorator';
import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import { AppConfigService } from '../../shared/services/app-config.service';
import { TelemetryLogger } from '../../shared/telemetry.logger';

@Controller('test')
@Auth({ public: true })
export class PricefeedTestController {
  #logger = new TelemetryLogger(PricefeedTestController.name);

  constructor(
    private readonly appConfig: AppConfigService,
    private readonly repo: CryptogadaiRepository,
  ) {}

  @Post('setup-price-feed')
  async setupPriceFeed(
    @Body()
    body: {
      blockchainKey: string;
      baseCurrencyTokenId: string;
      quoteCurrencyTokenId: string;
      source?: string;
      bidPrice?: number;
      askPrice?: number;
      sourceDate?: string;
    },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    const {
      blockchainKey,
      baseCurrencyTokenId,
      quoteCurrencyTokenId,
      source = 'test',
      bidPrice = 1.0,
      askPrice = 1.0,
      sourceDate,
    } = body;

    if (!blockchainKey || typeof blockchainKey !== 'string') {
      throw new BadRequestException('blockchainKey is required');
    }
    if (!baseCurrencyTokenId || typeof baseCurrencyTokenId !== 'string') {
      throw new BadRequestException('baseCurrencyTokenId is required');
    }
    if (!quoteCurrencyTokenId || typeof quoteCurrencyTokenId !== 'string') {
      throw new BadRequestException('quoteCurrencyTokenId is required');
    }

    const effectiveSourceDate = sourceDate ? new Date(sourceDate) : new Date();

    const result = await this.repo.testSetupPriceFeeds({
      blockchainKey,
      baseCurrencyTokenId,
      quoteCurrencyTokenId,
      source,
      bidPrice,
      askPrice,
      sourceDate: effectiveSourceDate,
    });

    this.#logger.debug(
      `Set up price feed for ${baseCurrencyTokenId}/${quoteCurrencyTokenId} on ${blockchainKey}`,
    );

    return {
      success: true,
      message: `Price feed set up for ${baseCurrencyTokenId}/${quoteCurrencyTokenId}`,
      priceFeedId: result.priceFeedId,
      exchangeRateId: result.exchangeRateId,
      bidPrice,
      askPrice,
    };
  }

  @Post('verify-price-feed')
  async verifyPriceFeed(
    @Body()
    body: { blockchainKey: string; collateralTokenId: string },
  ) {
    if (this.appConfig.isProduction) {
      throw new Error('Test endpoints are not available in production');
    }

    const { blockchainKey, collateralTokenId } = body;

    if (!blockchainKey || typeof blockchainKey !== 'string') {
      throw new BadRequestException('blockchainKey is required');
    }
    if (!collateralTokenId || typeof collateralTokenId !== 'string') {
      throw new BadRequestException('collateralTokenId is required');
    }

    try {
      const exchangeRate = await this.repo.borrowerGetsExchangeRate({
        collateralBlockchainKey: blockchainKey,
        collateralTokenId,
      });

      return {
        success: true,
        exchangeRate: {
          id: exchangeRate.id,
          bidPrice: exchangeRate.bidPrice,
          askPrice: exchangeRate.askPrice,
          sourceDate: exchangeRate.sourceDate,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }
}
