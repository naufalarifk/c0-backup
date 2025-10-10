import {
  Controller,
  Get,
  HttpStatus,
  Logger,
  Query,
  UseGuards,
  ValidationPipe,
} from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

import { TelemetryLogger } from '../../shared/telemetry.logger';
import { AuthGuard } from '../auth/auth.guard';
import {
  BlockchainsResponseDto,
  CurrenciesResponseDto,
  ExchangeRatesResponseDto,
  GetCurrenciesQueryDto,
  GetExchangeRatesQueryDto,
} from './dto/finance-config.dto';
import { FinanceConfigService } from './finance-config.service';

@ApiTags('Blockchain Management')
@Controller('blockchains')
@UseGuards(AuthGuard)
export class BlockchainController {
  private readonly logger = new TelemetryLogger(BlockchainController.name);

  constructor(private readonly financeConfigService: FinanceConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get supported blockchains',
    description: `
      Retrieve list of supported blockchain networks for fund transfers and operations.
      
      **Blockchain Networks:**
      - Bitcoin: Main Bitcoin network
      - Ethereum Mainnet: Primary Ethereum network
      - Binance Smart Chain: BNB Smart Chain network
      - Solana: Solana mainnet
      
      **Usage:**
      - Network selection dropdowns in loan applications
      - Blockchain selection for fund transfers
      - Network validation and routing
    `,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Blockchains retrieved successfully',
    type: BlockchainsResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - authentication required',
  })
  async getBlockchains(): Promise<BlockchainsResponseDto> {
    this.logger.log('Getting supported blockchains');
    return await this.financeConfigService.getBlockchains();
  }
}

@ApiTags('Currency Management')
@Controller('currencies')
@UseGuards(AuthGuard)
export class CurrencyController {
  private readonly logger = new TelemetryLogger(CurrencyController.name);

  constructor(private readonly financeConfigService: FinanceConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get supported currencies',
    description: `
      Retrieve list of supported currencies for collateral and loan operations.
      
      **Currency Types:**
      - Collateral currencies: BTC, ETH, BNB, SOL with LTV configuration
      - Loan currencies: USDT on various networks
      
      **Usage:**
      - Loan creation forms to display available collateral options
      - Portfolio management to show supported assets
      - LTV calculation and risk assessment
    `,
  })
  @ApiQuery({
    name: 'type',
    description: 'Filter by currency usage type',
    enum: ['collateral', 'loan', 'all'],
    required: false,
    example: 'all',
  })
  @ApiQuery({
    name: 'blockchainKey',
    description: 'Filter by blockchain key (CAIP-2 format)',
    required: false,
    example: 'eip155:1',
  })
  @ApiQuery({
    name: 'minLtv',
    description: 'Filter currencies with minimum LTV ratio',
    required: false,
    type: 'number',
    example: 50.0,
  })
  @ApiQuery({
    name: 'maxLtv',
    description: 'Filter currencies with maximum LTV ratio',
    required: false,
    type: 'number',
    example: 70.0,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Currencies retrieved successfully',
    type: CurrenciesResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - invalid parameters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - authentication required',
  })
  async getCurrencies(
    @Query(new ValidationPipe({ transform: true })) queryParams: GetCurrenciesQueryDto,
  ): Promise<CurrenciesResponseDto> {
    this.logger.log('Getting supported currencies', { queryParams });
    return await this.financeConfigService.getCurrencies(queryParams);
  }
}

@ApiTags('Exchange Rates')
@Controller('exchange-rates')
@UseGuards(AuthGuard)
export class ExchangeRateController {
  private readonly logger = new TelemetryLogger(ExchangeRateController.name);

  constructor(private readonly financeConfigService: FinanceConfigService) {}

  @Get()
  @ApiOperation({
    summary: 'Get current exchange rates',
    description: `
      Retrieve current exchange rates for supported currency pairs.
      
      **Rate Sources:**
      - Real-time data from configured price feeds
      - Multiple sources aggregated for accuracy
      - Bid/ask spreads included for transparency
    `,
  })
  @ApiQuery({
    name: 'baseCurrencyBlockchainKey',
    description: 'Filter by base currency blockchain key (CAIP-2 format)',
    required: false,
    example: 'eip155:1',
  })
  @ApiQuery({
    name: 'baseCurrencyTokenId',
    description: 'Filter by base currency token ID (CAIP-19 format)',
    required: false,
    example: 'slip44:60',
  })
  @ApiQuery({
    name: 'quoteCurrencyBlockchainKey',
    description: 'Filter by quote currency blockchain key (CAIP-2 format)',
    required: false,
    example: 'eip155:56',
  })
  @ApiQuery({
    name: 'quoteCurrencyTokenId',
    description: 'Filter by quote currency token ID (CAIP-19 format)',
    required: false,
    example: 'erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
  })
  @ApiQuery({
    name: 'source',
    description: 'Filter by price feed source',
    required: false,
    example: 'binance',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Exchange rates retrieved successfully',
    type: ExchangeRatesResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Bad request - invalid parameters',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unauthorized - authentication required',
  })
  async getExchangeRates(
    @Query(new ValidationPipe({ transform: true })) queryParams: GetExchangeRatesQueryDto,
  ): Promise<ExchangeRatesResponseDto> {
    this.logger.log('Getting exchange rates', { queryParams });
    return await this.financeConfigService.getExchangeRates(queryParams);
  }
}
