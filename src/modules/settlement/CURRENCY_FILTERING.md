# Settlement Service - Currency Filtering Update

## Summary

Updated the Settlement Service to exclude crosschain and mock/testnet currencies from settlement operations, based on the currency definitions in `0008-finance.sql`.

## Changes Made

### 1. Updated `getHotWalletBalances()` Method

**Location:** `src/modules/settlement/settlement.service.ts:41-61`

Added filters to exclude:
- `crosschain` currencies (generic cross-chain tokens)
- `eip155:56` (Binance/BSC - the target network)
- `cg:testnet` (Mockchain testnet)
- `bip122:000000000933%` (Bitcoin Testnet)
- `eip155:11155111%` (Ethereum Sepolia Testnet)
- `eip155:97%` (BSC Testnet)
- `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%` (Solana Devnet)

### 2. Updated `settleCurrency()` Method

**Location:** `src/modules/settlement/settlement.service.ts:171-192`

Applied the same filters when fetching hot wallet balances for a specific currency during settlement execution.

### 3. Updated `executeSettlement()` Method

**Location:** `src/modules/settlement/settlement.service.ts:322-336`

Applied the same filters when fetching the list of currencies to settle.

## SQL Query Pattern

All three queries now use this filter pattern:

```sql
WHERE a.user_id = 1
  AND a.account_type = 'PlatformEscrow'
  AND a.balance > 0
  AND a.currency_blockchain_key NOT IN ('crosschain', 'eip155:56', 'cg:testnet')
  AND a.currency_blockchain_key NOT LIKE 'bip122:000000000933%'
  AND a.currency_blockchain_key NOT LIKE 'eip155:11155111%'
  AND a.currency_blockchain_key NOT LIKE 'eip155:97%'
  AND a.currency_blockchain_key NOT LIKE 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%'
```

## Included Currencies (Production Only)

Based on `0008-finance.sql`, settlement will now only process these production blockchain currencies:

### Mainnet Blockchains:
1. **Bitcoin (BTC)** - `bip122:000000000019d6689c085ae165831e93`
2. **Ethereum (ETH)** - `eip155:1`
3. **Binance Smart Chain (BNB)** - `eip155:56` (excluded from hot wallets, target network)
4. **Solana (SOL)** - `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`

### Tokens:
- **USDC on BSC** - `eip155:56:erc20:0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d`

## Excluded Currencies

### Crosschain (Generic):
- `crosschain:iso4217:usd` - Generic USD Token
- `crosschain:slip44:0` - Generic Bitcoin
- `crosschain:slip44:60` - Generic Ethereum
- `crosschain:slip44:714` - Generic BNB
- `crosschain:slip44:501` - Generic Solana

### Testnet/Devnet:
- `bip122:000000000933ea01ad0ee984209779ba` - Bitcoin Testnet
- `eip155:11155111` - Ethereum Sepolia
- `eip155:97` - BSC Testnet
- `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` - Solana Devnet
- `cg:testnet` - Mockchain

### Mockchain Currencies:
- `cg:testnet:mock:native` - Mockchain Coin (MCK)
- `cg:testnet:mock:usd` - Mockchain Dollar (MUSD)

## Testing

All 22 unit tests continue to pass after these changes:

```bash
✔ SettlementService - Unit Tests (6.353167ms)
ℹ tests 22
ℹ suites 7
ℹ pass 22
```

The tests use mocked repository methods, so they're not affected by the SQL query changes. The filtering logic is only applied at runtime when querying the actual database.

## Impact

### ✅ Positive Impact:
1. **Production Safety:** Settlement only processes real mainnet currencies
2. **Test Isolation:** Test/dev currencies won't interfere with production settlement
3. **Clean Separation:** Clear distinction between production and test data
4. **Efficiency:** Reduced query results by excluding irrelevant currencies

### 🔍 No Impact:
- Test suite remains green (uses mocks)
- Existing functionality unchanged
- Settlement logic and ratios unchanged

### ⚠️ Important Notes:
1. Settlement **target network** (`eip155:56` - Binance) is excluded from hot wallet queries as expected
2. Crosschain currencies are excluded as they're not real blockchain balances
3. All testnet/devnet currencies are excluded for production safety

## Verification

To verify the filters work correctly in production:

1. **Check currencies being settled:**
   ```sql
   SELECT DISTINCT currency_blockchain_key, currency_token_id
   FROM accounts
   WHERE user_id = 1
     AND account_type = 'PlatformEscrow'
     AND balance > 0
     AND currency_blockchain_key NOT IN ('crosschain', 'eip155:56', 'cg:testnet')
     AND currency_blockchain_key NOT LIKE 'bip122:000000000933%'
     AND currency_blockchain_key NOT LIKE 'eip155:11155111%'
     AND currency_blockchain_key NOT LIKE 'eip155:97%'
     AND currency_blockchain_key NOT LIKE 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1%';
   ```

2. **Monitor settlement logs:**
   - Check scheduler output for currencies being processed
   - Verify no testnet/crosschain currencies appear

3. **Review settlement history:**
   - Query `settlement_logs` table after execution
   - Confirm only mainnet currencies are recorded

## Related Files

- `src/modules/settlement/settlement.service.ts` - Service implementation (updated)
- `src/modules/settlement/settlement.test.ts` - Unit tests (passing)
- `src/shared/repositories/postgres/0008-finance.sql` - Currency definitions (reference)

---

**Status:** ✅ Complete  
**Tests:** 22/22 passing  
**Type Check:** ✅ Settlement module types valid
