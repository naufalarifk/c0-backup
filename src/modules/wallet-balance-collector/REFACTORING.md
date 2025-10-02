# Wallet Balance Collector Refactoring

## Overview
Refactored the wallet balance collector module to follow the same factory pattern implementation as the notifications module, improving maintainability and extensibility.

## Architecture Pattern

### Factory Pattern with Decorators
- **Abstract Base Class**: `BalanceCollector` - defines interface for all collectors
- **Factory Service**: `BalanceCollectorFactory` - discovers and routes to appropriate collectors
- **Decorator**: `@CollectorFlag()` - marks blockchain-specific implementations
- **Discovery**: Uses NestJS `DiscoveryService` for runtime provider resolution

### Structure
```
wallet-balance-collector/
├── balance-collection.types.ts       # Type definitions
├── balance-collector.abstract.ts     # Abstract base class
├── balance-collector.factory.ts      # Factory with decorator discovery
├── wallet-balance-collector.service.ts   # Main service (delegates to factory)
├── wallet-balance-collector.processor.ts # BullMQ processor
├── wallet-balance-collector.queue.service.ts # Queue management
└── collectors/
    ├── evm-balance.collector.ts      # Ethereum mainnet
    ├── bsc-balance.collector.ts      # BSC mainnet
    ├── sepolia-balance.collector.ts  # Ethereum Sepolia testnet
    ├── solana-balance.collector.ts   # Solana mainnet (placeholder)
    └── bitcoin-balance.collector.ts  # Bitcoin mainnet (placeholder)
```

## Implementation Details

### 1. Type Definitions (`balance-collection.types.ts`)
```typescript
export const BlockchainNetworkEnum = {
  EthereumMainnet: 'eip155:1',
  BSCMainnet: 'eip155:56',
  EthereumSepolia: 'eip155:11155111',
  SolanaMainnet: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  BitcoinMainnet: 'bip122:000000000019d6689c085ae165831e93',
};

export type BlockchainNetwork = string; // Flexible to support dynamic chains
```

### 2. Abstract Base Class
```typescript
@Injectable()
export abstract class BalanceCollector {
  abstract canHandle(blockchainKey: string): boolean;
  abstract collect(request: BalanceCollectionRequest): Promise<BalanceCollectionResult>;
  abstract checkBalance(walletAddress: string): Promise<bigint>;
  abstract transferToHotWallet(request: BalanceCollectionRequest): Promise<string>;
}
```

### 3. Factory with Decorator Discovery
```typescript
@Injectable()
export class BalanceCollectorFactory {
  private collectors: BalanceCollector[];

  constructor(private readonly discoveryService: DiscoveryService) {
    this.collectors = this.discoverCollectors();
  }

  getCollector(blockchainKey: string): BalanceCollector {
    const collector = this.collectors.find((c) => c.canHandle(blockchainKey));
    if (!collector) {
      throw new Error(`No collector found for blockchain: ${blockchainKey}`);
    }
    return collector;
  }
}
```

### 4. Blockchain-Specific Collectors

#### EVM Collector (Base for Ethereum-compatible chains)
```typescript
@Injectable()
@CollectorFlag(BlockchainNetworkEnum.EthereumMainnet)
export class EVMBalanceCollector extends BalanceCollector {
  async collect(request: BalanceCollectionRequest): Promise<BalanceCollectionResult> {
    // Implementation with gas reserve handling
  }
}
```

#### BSC Collector (Extends EVM)
```typescript
@Injectable()
@CollectorFlag(BlockchainNetworkEnum.BSCMainnet)
export class BSCBalanceCollector extends EVMBalanceCollector {
  protected getRpcUrl(): string {
    return 'https://bsc-dataseed1.binance.org';
  }
}
```

## Benefits

### 1. **Extensibility**
- Add new blockchain support by creating a new collector class
- No need to modify existing code
- Each collector is self-contained

### 2. **Type Safety**
- Strong typing with TypeScript
- Compile-time checks for blockchain networks
- Runtime validation with type guards

### 3. **Testability**
- Each collector can be tested independently
- Easy to mock specific collectors
- Unit tests remain fast and focused

### 4. **Maintainability**
- Clear separation of concerns
- Each blockchain's logic is isolated
- Easy to understand and modify

### 5. **Consistency**
- Follows the same pattern as notifications module
- Familiar architecture for team members
- Reduces cognitive load

## Migration from Old Implementation

### Before
```typescript
// All blockchain logic in one service
class WalletBalanceCollectorService {
  async collectBalance(data) {
    // Switch/if statements for each blockchain
    if (blockchainKey === 'eip155:1') {
      // Ethereum logic
    } else if (blockchainKey === 'eip155:56') {
      // BSC logic
    }
    // ... more chains
  }
}
```

### After
```typescript
// Service delegates to factory
class WalletBalanceCollectorService {
  async collectBalance(data) {
    const collector = this.factory.getCollector(data.blockchainKey);
    return collector.collect(data);
  }
}

// Each blockchain has its own collector
@CollectorFlag(BlockchainNetworkEnum.EthereumMainnet)
class EVMBalanceCollector extends BalanceCollector {
  async collect(request) {
    // Ethereum-specific logic
  }
}
```

## Testing

All tests pass successfully:
- ✅ Unit tests: Queue and processor functionality
- ✅ Integration tests: Derivation path validation
- ✅ Compilation: No TypeScript errors

```bash
# Run tests
pnpm test src/modules/wallet-balance-collector/wallet-balance-collector.test.ts
pnpm test src/modules/wallet-balance-collector/wallet-balance-collector.integration.test.ts
```

## Future Enhancements

1. **Solana Collector**: Complete implementation for Solana mainnet
2. **Bitcoin Collector**: Complete implementation for Bitcoin mainnet
3. **Additional Networks**: Add support for Polygon, Avalanche, etc.
4. **Gas Optimization**: Implement chain-specific gas estimation strategies
5. **Retry Logic**: Add exponential backoff for failed transfers
6. **Metrics**: Add OpenTelemetry tracing for each collector

## References

- Notifications Module: `/src/modules/notifications/`
- Factory Pattern: Similar to `NotificationProviderFactory`
- Decorator Pattern: Similar to `@NotificationProviderFlag()`
