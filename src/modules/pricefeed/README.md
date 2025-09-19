# Price Feed Module

A comprehensive, scalable price feed system for fetching and managing exchange rates from multiple sources using NestJS and BullMQ.

## Architecture Overview

The Price Feed module follows a worker-based architecture similar to the notifications module, providing:

- **Extensible Worker System**: Add new price feed sources easily
- **Queue-Based Processing**: Reliable background job processing with retry logic
- **Multiple Data Sources**: Support for CoinGecko, Binance, Coinbase, and more
- **Type Safety**: Full TypeScript support with strict typing
- **Error Handling**: Comprehensive error handling and logging

## Module Structure

```
src/modules/pricefeed/
├── pricefeed.module.ts           # NestJS module configuration
├── pricefeed.service.ts          # Main service orchestrating operations
├── pricefeed.types.ts            # Type definitions and enums
├── pricefeed-worker.abstract.ts  # Base class for all workers
├── pricefeed-scheduler.service.ts # Example scheduled operations
├── workers/
│   ├── exchange-rate-fetcher.worker.ts  # Fetches rates from external sources
│   ├── exchange-rate-updater.worker.ts  # Updates rates in database
│   └── index.ts                         # Worker exports
├── providers/
│   ├── coingecko.provider.ts    # CoinGecko API integration
│   └── index.ts                 # Provider exports
└── index.ts                     # Module exports
```

## Core Components

### 1. PriceFeedService

The main service that coordinates all price feed operations:

```typescript
@Injectable()
export class PriceFeedService {
  // Queue exchange rate fetch from external sources
  async queueExchangeRateFetch(data: ExchangeRateFetcherData): Promise<void>
  
  // Queue exchange rate update in database
  async queueExchangeRateUpdate(data: ExchangeRateUpdaterData): Promise<void>
  
  // Process work immediately (useful for testing)
  async processWork(data: AnyPriceFeedWorkerData): Promise<void>
  
  // Get current queue status
  async getQueueStatus(): Promise<QueueStatus>
}
```

### 2. Worker System

All workers extend `PriceFeedWorkerBase` and implement the `processWork` method:

```typescript
@PriceFeedWorker(PriceFeedWorkerType.EXCHANGE_RATE_FETCHER)
export class ExchangeRateFetcherWorker extends PriceFeedWorkerBase<ExchangeRateFetcherData> {
  async processWork(data: ExchangeRateFetcherData): Promise<void> {
    // Implementation here
  }
}
```

### 3. Provider System

Data source providers implement standardized interfaces for fetching price data:

```typescript
export interface PriceFeedProvider {
  fetchExchangeRate(params: FetchExchangeRateParams): Promise<ExchangeRateData>;
  isAvailable(): Promise<boolean>;
}
```

## Usage Examples

### Basic Setup

1. Import the module in your app:

```typescript
import { PriceFeedModule } from './modules/pricefeed';

@Module({
  imports: [
    // ... other modules
    PriceFeedModule,
  ],
})
export class AppModule {}
```

2. Inject the service:

```typescript
constructor(private readonly priceFeedService: PriceFeedService) {}
```

### Fetching Exchange Rates

```typescript
// Queue a fetch job using CoinMarketCap
await this.priceFeedService.queueExchangeRateFetch({
  blockchainKey: 'bitcoin',
  baseCurrencyTokenId: 'BTC',
  quoteCurrencyTokenId: 'USD',
  sources: [PriceFeedSource.COINMARKETCAP],
});

// Process immediately (for testing)
await this.priceFeedService.processWork({
  type: PriceFeedWorkerType.EXCHANGE_RATE_FETCHER,
  timestamp: new Date(),
  blockchainKey: 'ethereum',
  baseCurrencyTokenId: 'ETH',
  quoteCurrencyTokenId: 'USD',
  sources: [PriceFeedSource.COINMARKETCAP],
});
```

### Updating Exchange Rates

```typescript
await this.priceFeedService.queueExchangeRateUpdate({
  priceFeedId: 'price-feed-uuid',
  bidPrice: '45000.50',
  askPrice: '45001.25',
  source: PriceFeedSource.COINGECKO,
  sourceDate: new Date(),
  retrievalDate: new Date(),
});
```

### Scheduled Operations

Use the provided scheduler service or create your own:

```typescript
import { PriceFeedSchedulerService } from './pricefeed-scheduler.service';

// This service includes:
// - Automatic fetching every 30 seconds
// - Queue status monitoring every 5 minutes
// - Manual trigger methods
```

## Supported Price Feed Sources

| Source | Enum Value | Status | Notes |
|--------|------------|---------|-------|
| CoinMarketCap | `PriceFeedSource.COINMARKETCAP` | ✅ Implemented | Professional API with credits |
| CoinGecko | `PriceFeedSource.COINGECKO` | 🔄 Planned | Free tier available |
| Binance | `PriceFeedSource.BINANCE` | 🔄 Planned | High frequency updates |
| Coinbase | `PriceFeedSource.COINBASE` | 🔄 Planned | Professional data |
| Custom | `PriceFeedSource.CUSTOM` | ✅ Available | For internal sources |

## Worker Types

| Worker | Enum Value | Purpose |
|--------|------------|---------|
| Exchange Rate Fetcher | `EXCHANGE_RATE_FETCHER` | Fetch rates from external APIs |
| Exchange Rate Updater | `EXCHANGE_RATE_UPDATER` | Update rates in database |

## Configuration

### CoinMarketCap Setup

1. **Get API Key**: Sign up at [CoinMarketCap Pro API](https://pro.coinmarketcap.com/)
2. **Choose Plan**: 
   - **Basic (Free)**: 333 calls/day, 10 calls/minute
   - **Hobbyist ($29/month)**: 3,333 calls/day, 30 calls/minute  
   - **Startup ($99/month)**: 10,000 calls/day, 60 calls/minute
   - **Standard ($499/month)**: 100,000 calls/day, 300 calls/minute

3. **Add to Environment**: Set `PRICEFEED_API_KEY` in your `.env` file

### API Credit Usage

- **Single Price Fetch**: 1 credit per 100 cryptocurrencies
- **Bulk Operations**: More efficient than individual calls
- **Map Updates**: Cached for 24 hours to minimize credit usage
- **Error Handling**: Failed requests don't consume credits

### Environment Variables

```bash
# Redis configuration for BullMQ (if different from default)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Price feed specific settings
PRICE_FEED_QUEUE_NAME=price-feed-queue
PRICE_FEED_RETRY_ATTEMPTS=3
PRICE_FEED_RETRY_DELAY=5000

# CoinMarketCap API (REQUIRED)
PRICEFEED_API_KEY=your-coinmarketcap-api-key-here

# Other external API keys (optional)
COINGECKO_API_KEY=your-api-key-here
BINANCE_API_KEY=your-api-key-here
COINBASE_API_KEY=your-api-key-here
```

### Queue Configuration

The module uses BullMQ with the following default settings:

- **Queue Name**: `price-feed-queue`
- **Max Retry Attempts**: 3
- **Retry Delay**: 5 seconds (exponential backoff)
- **Job Timeout**: 30 seconds

## Error Handling

The module includes comprehensive error handling:

1. **Network Errors**: Automatic retry with exponential backoff
2. **API Rate Limits**: Intelligent delay and retry strategies
3. **Data Validation**: Type checking and data sanitization
4. **Database Errors**: Transaction rollback and error logging
5. **Queue Failures**: Dead letter queue for failed jobs

## Monitoring and Observability

### Queue Metrics

```typescript
const status = await priceFeedService.getQueueStatus();
console.log({
  waiting: status.waiting,    // Jobs waiting to be processed
  active: status.active,      // Currently processing jobs
  completed: status.completed, // Successfully completed jobs
  failed: status.failed       // Failed jobs
});
```

### Logging

All operations are logged with appropriate levels:

- **INFO**: Successful operations, queue status
- **WARN**: Retry attempts, API rate limits
- **ERROR**: Failed operations, critical issues

## Testing

### Unit Tests

```bash
# Run all price feed tests
pnpm test src/modules/pricefeed

# Run specific worker tests
pnpm test src/modules/pricefeed/workers
```

### Integration Tests

```bash
# Run E2E tests including price feed operations
pnpm test:e2e
```

### Manual Testing

Use the example service methods for manual testing:

```typescript
import { CoinMarketCapPriceFeedExample } from './coinmarketcap-example.service';

// Inject the example service
constructor(private readonly cmcExample: CoinMarketCapPriceFeedExample) {}

// Test Bitcoin price fetch
await this.cmcExample.fetchBitcoinPriceNow();

// Test bulk cryptocurrency fetch
await this.cmcExample.fetchCryptoBulk();

// Check service status
const status = await this.cmcExample.getServiceStatus();
console.log(status);
```

## Extending the Module

### Adding New Data Sources

1. Create a new provider:

```typescript
@Injectable()
export class CustomProvider implements PriceFeedProvider {
  async fetchExchangeRate(params: FetchExchangeRateParams): Promise<ExchangeRateData> {
    // Implementation
  }
  
  async isAvailable(): Promise<boolean> {
    // Check if service is available
  }
}
```

2. Add to the providers array in module
3. Add new source to `PriceFeedSource` enum

### Adding New Worker Types

1. Create new worker class extending `PriceFeedWorkerBase`
2. Add new type to `PriceFeedWorkerType` enum
3. Update type definitions in `pricefeed.types.ts`
4. Register in worker factory

## Performance Considerations

- **Batch Processing**: Group multiple currency pairs in single requests when possible
- **Caching**: Implement Redis caching for frequently requested rates
- **Rate Limiting**: Respect API rate limits to avoid blocking
- **Queue Optimization**: Monitor queue performance and adjust concurrency

## Security

- **API Key Management**: Store API keys securely using environment variables
- **Input Validation**: All input data is validated before processing
- **Error Sanitization**: Sensitive data is removed from error logs
- **Rate Limiting**: Built-in protection against API abuse

## Troubleshooting

### Common Issues

1. **Queue Not Processing**: Check Redis connection and queue configuration
2. **API Errors**: Verify API keys and rate limits
3. **Data Inconsistency**: Check database constraints and validation rules
4. **Memory Issues**: Monitor job concurrency and payload sizes

### Debug Mode

Enable debug logging:

```bash
DEBUG=price-feed:* pnpm start:dev
```

This will show detailed logs for all price feed operations.