# Settlement Module

## Overview
Automated settlement system that maintains balance ratio between hot wallets and Binance Smart Chain. Runs daily at midnight UTC to ensure proper liquidity distribution across the platform.

## Business Logic (from settlement.md)

The platform uses a cross-chain balance model where:
- Users deposit USDT on various blockchains (Ethereum, Solana, etc.)
- Platform maintains internal `crosschain` accounting
- Users can withdraw to any supported blockchain

### Settlement Formula
```
(hot_wallet_total) / binance_balance = configured_ratio

Where:
- hot_wallet_total = Sum of balances on Ethereum + Solana + other chains
- binance_balance = Balance on Binance Smart Chain (eip155:56)
- configured_ratio = Default 50% (0.5)
```

### Example with 50% Ratio:
- Hot wallets: 100 USDT (Ethereum + Solana)
- Binance should have: 100 USDT
- Total system: 200 USDT (50% in hot wallets, 50% on Binance)

## Features
- **Automated Daily Settlement**: Cron job runs at 00:00 UTC
- **Ratio-Based Balancing**: Maintains configured ratio between hot wallets and Binance
- **Multi-Currency Support**: Processes USDT across all blockchains
- **Proportional Transfers**: Transfers from each hot wallet proportionally
- **Audit Trail**: All settlements logged to `settlement_logs` table
- **Manual Trigger**: Support for manual settlement execution via API or CLI
- **Type Safe**: Runtime type validation using typeshaper Module

## Overview
Automated settlement system that runs daily at midnight to transfer 50% of blockchain balances to Binance Smart Chain (BSC).

## Features
- **Automated Daily Settlement**: Cron job runs at 00:00 UTC
- **Configurable**: Settlement percentage, target network, and enable/disable via environment variables
- **Audit Trail**: All settlements logged to `settlement_logs` table
- **Manual Trigger**: Support for manual settlement execution via API or CLI
- **Discovery Integration**: Uses NestJS DiscoveryService utilities
- **Type Safe**: Runtime type validation using typeshaper

## Architecture

### Files
1. **settlement.types.ts** - Type definitions and configuration
   - `SettlementConfig`: Configuration interface
   - `SettlementResult`: Settlement result interface
   - `BlockchainBalance`: Balance aggregation interface
   - `defaultSettlementConfig`: Default configuration

2. **settlement.service.ts** - Core business logic
   - `getBlockchainBalances()`: Aggregates balances from wallet_balances table
   - `calculateSettlementAmount()`: Calculates settlement amount based on percentage
   - `settleBlockchainBalance()`: Processes individual blockchain settlement
   - `executeSettlement()`: Main orchestration method
   - `storeSettlementResults()`: Logs settlements to database
   - `getSettlementHistory()`: Retrieves past settlements

3. **settlement.scheduler.ts** - Cron job scheduler
   - `@Cron('0 0 * * *')`: Runs at midnight UTC
   - `handleSettlementCron()`: Scheduled execution handler
   - `triggerManualSettlement()`: Manual execution method
   - Config-based enable/disable

4. **settlement.module.ts** - NestJS module
   - Imports: ConfigModule, DiscoveryModule, ScheduleModule, RepositoryModule
   - Providers: SettlementService, SettlementScheduler
   - Exports: SettlementService

## Environment Variables

```bash
# Enable/disable settlement scheduler (default: true)
SETTLEMENT_ENABLED=true

# Settlement percentage (default: 50)
SETTLEMENT_PERCENTAGE=50

# Target blockchain network (default: eip155:56 for BSC)
SETTLEMENT_TARGET_NETWORK=eip155:56
```

## Database Schema

### settlement_logs table
```sql
CREATE TABLE settlement_logs (
  id SERIAL PRIMARY KEY,
  blockchain_key VARCHAR(255) NOT NULL,
  original_balance DECIMAL(30, 18) NOT NULL,
  settlement_amount DECIMAL(30, 18) NOT NULL,
  remaining_balance DECIMAL(30, 18) NOT NULL,
  transaction_hash VARCHAR(255),
  success BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  settled_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_settlement_logs_blockchain ON settlement_logs(blockchain_key);
CREATE INDEX idx_settlement_logs_settled_at ON settlement_logs(settled_at DESC);
```

## Usage

### Run Settlement Worker
```bash
# Start settlement worker
pnpm worker settlement

# Or using make
make worker WORKER=settlement
```

### Manual Settlement Trigger
Can be triggered via admin API endpoint or direct service call:
```typescript
const settlementScheduler = app.get(SettlementScheduler);
await settlementScheduler.triggerManualSettlement();
```

## Cron Schedule
- **Schedule**: `0 0 * * *` (midnight UTC)
- **Timezone**: UTC
- **Name**: `settlement-daily`

## Completed Features
- ✅ Implement actual blockchain transfer logic using WalletService
- ✅ Database migration for settlement_logs table
- ✅ Automated cron job scheduler for midnight execution
- ✅ Settlement command definition in commands.ts
- ✅ Type-safe database queries with runtime validation
- ✅ Configurable settlement percentage and target network

## TODO (Future Enhancements)
- [ ] Add admin API endpoint for manual trigger (can use SettlementScheduler.triggerManualSettlement())
- [ ] Add retry mechanism for failed settlements
- [ ] Add monitoring/alerting for settlement failures (e.g., Prometheus metrics)
- [ ] Add settlement dry-run mode for testing
- [ ] Implement settlement transaction fee calculation and optimization
- [ ] Add multi-network support (currently targets BSC by default)
- [ ] Add settlement amount limits and safety checks

## Testing
```bash
# Run settlement tests
pnpm test settlement

# View settlement logs
pnpm db:studio
# Navigate to settlement_logs table
```

## Integration Points
- **DiscoveryService**: Uses @nestjs/core discovery utilities
- **RepositoryModule**: Database access via CryptogadaiRepository
- **ConfigModule**: Environment-based configuration
- **ScheduleModule**: Cron job scheduling
- **TelemetryLogger**: Logging and monitoring

## Implementation Notes
1. Settlement percentage is configurable (default 50%)
2. Targets Binance Smart Chain (eip155:56) by default
3. All settlements are logged for audit trail
4. Scheduler can be disabled via SETTLEMENT_ENABLED=false
5. Uses typeshaper for runtime type validation on SQL queries
6. Follows same pattern as pricefeed and other workers
7. Blockchain transfer logic is placeholder - needs Web3/Ethers implementation
