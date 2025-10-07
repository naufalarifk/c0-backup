# Settlement Module Tests

This document describes the test suite for the settlement module.

## Test Structure

The settlement tests are located in `settlement.test.ts` and use the NestJS Testing module with in-memory repository for isolated unit testing.

## Test Suites

### 1. Ratio Calculations

Tests the core mathematical formulas used for balance rebalancing.

**Tests:**
- `should calculate required Binance balance correctly for 50% ratio`
  - Verifies: `binance = hot_wallets * (0.5 / 0.5) = hot_wallets`
  - Example: 100 USDT hot wallets → 100 USDT required in Binance

- `should calculate required Binance balance correctly for 33% ratio`
  - Verifies: `binance = hot_wallets * (0.33 / 0.67) ≈ hot_wallets * 0.492`
  - Example: 100 USDT hot wallets → ~49.25 USDT required in Binance

- `should calculate required Binance balance correctly for 66% ratio`
  - Verifies: `binance = hot_wallets * (0.66 / 0.34) ≈ hot_wallets * 1.94`
  - Example: 100 USDT hot wallets → ~194.12 USDT required in Binance

- `should calculate settlement amount when Binance is below target`
  - Verifies positive settlement (transfer TO Binance)
  - Example: 100 hot, 70 Binance → need +30 TO Binance

- `should calculate settlement amount when Binance is above target`
  - Verifies negative settlement (withdraw FROM Binance)
  - Example: 100 hot, 130 Binance → need -30 FROM Binance

- `should calculate zero settlement when balance is at target`
  - Verifies no transfer needed when ratio is correct
  - Example: 100 hot, 100 Binance → need 0 (no transfer)

### 2. Database Queries

Tests the SQL queries used to fetch balances from the `accounts` table.

**Tests:**
- `should fetch hot wallet balances correctly`
  - Setup: Creates platform escrow accounts on multiple blockchains
  - Verifies: Excludes crosschain and Binance (eip155:56)
  - Checks: Correct balances returned for Ethereum and Solana

- `should fetch Binance balance correctly`
  - Setup: Creates Binance account (eip155:56)
  - Verifies: Correctly queries and returns Binance balance

- `should return zero for non-existent Binance balance`
  - Verifies: Returns "0" when currency doesn't exist in Binance

- `should handle multiple currencies correctly`
  - Setup: Creates accounts with USDT and ETH
  - Verifies: Correctly groups by currency and blockchain

### 3. Settlement History

Tests the audit trail functionality.

**Tests:**
- `should store settlement results in database`
  - Verifies: Settlement results are persisted to `settlement_logs` table
  - Checks: All fields are stored correctly (tx hash, amounts, status)

- `should retrieve settlement history with limit`
  - Setup: Stores multiple settlement results
  - Verifies: Results are ordered by timestamp DESC (most recent first)
  - Checks: Limit parameter works correctly

- `should store failed settlement results with error messages`
  - Verifies: Failed settlements are logged with error details
  - Checks: No transaction hash for failed transfers

### 4. Configuration

Tests the configuration handling.

**Tests:**
- `should respect disabled settlement configuration`
  - Setup: `SETTLEMENT_ENABLED=false`
  - Verifies: Returns empty array when disabled

- `should use custom settlement percentage from config`
  - Setup: `SETTLEMENT_PERCENTAGE=33`
  - Verifies: Custom ratio is applied correctly

- `should use custom target network from config`
  - Setup: `SETTLEMENT_TARGET_NETWORK=eip155:137` (Polygon)
  - Verifies: Custom target network is respected

### 5. Edge Cases

Tests boundary conditions and special scenarios.

**Tests:**
- `should handle zero balances`
  - Verifies: Returns "0" for zero hot wallet balance

- `should handle very small balances`
  - Verifies: Calculations work with 0.001 amounts

- `should handle very large balances`
  - Verifies: Calculations work with 1 billion amounts

- `should return empty array when no currencies have balances`
  - Verifies: No settlement executed when no balances exist

## Test Data

### Account Structure

```sql
-- Platform Escrow Accounts (user_id = 1)
INSERT INTO accounts (
  user_id, 
  account_type, 
  currency_blockchain_key, 
  currency_token_id, 
  balance
) VALUES 
  (1, 'PlatformEscrow', 'eip155:1', 'erc20:0xusdt', 60),           -- Ethereum USDT
  (1, 'PlatformEscrow', 'solana:...', 'spl:...', 40),              -- Solana USDT
  (1, 'PlatformEscrow', 'eip155:56', 'erc20:0xusdt', 70),          -- Binance USDT
  (1, 'PlatformEscrow', 'crosschain', 'crosschain:usdt', 170);     -- Virtual balance
```

### Example Ratio Calculations

| Ratio | Hot Wallets | Binance Target | Total | Binance % |
|-------|-------------|----------------|-------|-----------|
| 50%   | 100         | 100            | 200   | 50%       |
| 33%   | 100         | 49.25          | 149.25| 33%       |
| 66%   | 100         | 194.12         | 294.12| 66%       |

## Running the Tests

```bash
# Run settlement tests only
pnpm test -- --grep "SettlementService"

# Run with build
pnpm build && pnpm test -- --grep "SettlementService"

# Run all tests
pnpm test
```

## Test Coverage

The test suite covers:
- ✅ Ratio calculation formulas
- ✅ Database queries (hot wallets, Binance, multi-currency)
- ✅ Settlement history (storage and retrieval)
- ✅ Configuration handling
- ✅ Edge cases (zero, very small, very large amounts)
- ✅ Type safety with typeshaper
- ⚠️  Blockchain transfers (mocked via WalletService)

## Notes

1. **In-Memory Repository**: Tests use `InMemoryCryptogadaiRepository` for fast, isolated testing without external dependencies.

2. **Type Safety**: All tests use `typeshaper` assertions to validate response types at runtime.

3. **Private Method Testing**: Settlement history tests access private `storeSettlementResults()` method via type assertion for testing purposes.

4. **No Network Calls**: Tests do not make actual blockchain transfers. The `WalletService` is included but not exercised in these unit tests.

5. **Deterministic**: All tests use known inputs and verify exact outputs - no conditional checks or random data.

## Related Documentation

- `README.md` - User-facing documentation
- `CORRECTED_IMPLEMENTATION.md` - Detailed implementation notes
- `settlement.md` - Business logic specification
- `ARCHITECTURE.md` - Technical architecture
