import { Injectable, Logger } from '@nestjs/common';

import { CryptogadaiRepository } from '../../shared/repositories/cryptogadai.repository';
import {
  BlockchainsResponseDto,
  CurrenciesResponseDto,
  ExchangeRatesResponseDto,
  GetCurrenciesQueryDto,
  GetExchangeRatesQueryDto,
} from './dto/finance-config.dto';

@Injectable()
export class FinanceConfigService {
  private readonly logger = new Logger(FinanceConfigService.name);

  constructor(private readonly repository: CryptogadaiRepository) {}

  /**
   * Get all supported blockchain networks
   */
  async getBlockchains(): Promise<BlockchainsResponseDto> {
    try {
      const result = await this.repository.userViewsBlockchains({});

      return {
        success: true,
        data: {
          blockchains: result.blockchains,
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve blockchains', error);
      throw error;
    }
  }

  /**
   * Get supported currencies with optional filtering
   */
  async getCurrencies(queryParams: GetCurrenciesQueryDto): Promise<CurrenciesResponseDto> {
    try {
      const { type, blockchainKey, minLtv, maxLtv } = queryParams;

      const result = await this.repository.userViewsCurrencies({
        type: type || 'all',
        blockchainKey,
        minLtv,
        maxLtv,
      });

      return {
        success: true,
        data: {
          currencies: result.currencies,
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve currencies', error);
      throw error;
    }
  }

  /**
   * Get current exchange rates with optional filtering
   */
  async getExchangeRates(queryParams: GetExchangeRatesQueryDto): Promise<ExchangeRatesResponseDto> {
    try {
      const {
        baseCurrencyBlockchainKey,
        baseCurrencyTokenId,
        quoteCurrencyBlockchainKey,
        quoteCurrencyTokenId,
        source,
      } = queryParams;

      const result = await this.repository.userViewsExchangeRates({
        baseCurrencyBlockchainKey,
        baseCurrencyTokenId,
        quoteCurrencyBlockchainKey,
        quoteCurrencyTokenId,
        source,
      });

      return {
        success: true,
        data: {
          exchangeRates: result.exchangeRates,
          lastUpdated: result.lastUpdated,
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve exchange rates', error);
      throw error;
    }
  }
}
