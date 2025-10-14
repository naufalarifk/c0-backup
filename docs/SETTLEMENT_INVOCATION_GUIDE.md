# Settlement Invocation Guide

## Summary

We've set up the environment for production/mainnet settlement, but there are compilation errors that need to be fixed before the server can start.

## Environment Configuration ✅

The `.env` file has been updated for mainnet:
- `NODE_ENV=development` (kept as development to allow proper app bootstrap)
- `BINANCE_API_BASE_URL=https://api.binance.com` (production API)
- `BINANCE_USE_TESTNET=false`
- `SOLANA_USE_DEVNET=false`
- Production Binance API keys are configured

## Issues to Fix

### 1. Binance Service Method Names

The `BinanceWalletDepositService` is calling old method names that don't exist:
- ❌ `getCurrencyToBinanceCoin()` → ✅ `tokenToBinanceAsset()` 
- ❌ `getBlockchainToBinanceNetwork()` → ✅ `blockchainKeyToBinanceNetwork()`

**Files to fix:**
- `src/modules/settlement/services/binance/binance-wallet-deposit.service.ts` (lines 46, 48, 120, 169)

**Correct usage:**
```typescript
// Get asset mapping
const assetMapping = this.assetMapper.tokenToBinanceAsset(currencyTokenId);
if (!assetMapping) {
  throw new Error(`No Binance mapping for ${currencyTokenId}`);
}

// Access properties
const binanceCoin = assetMapping.asset;  // NOT binanceAsset
const binanceNetwork = assetMapping.network;

// Get network mapping
const binanceNetwork = this.assetMapper.blockchainKeyToBinanceNetwork(blockchainKey);
```

### 2. Settlement Admin Module Dependency

The `SettlementAdminModule` is trying to import `TransactionMatchingService` but it's not available in that module's imports.

**Fix:** Add `SettlementModule` to `SettlementAdminModule` imports, or export `TransactionMatchingService` from `SettlementModule`.

## How to Invoke Settlement

Once the compilation errors are fixed, there are three ways to invoke settlement:

### Method 1: API Endpoint (Recommended)

I've added a new endpoint to manually trigger settlement:

```bash
# Start the server
pnpm start:dev

# Trigger settlement via API
curl -X POST http://localhost:3000/test/settlement/execute-settlement

# Response will include:
# - Success/failure status
# - Number of settlements executed
# - Details for each settlement (blockchain, amounts, tx hashes, errors)
```

### Method 2: Scheduler (Automatic)

Configure in `.env`:
```properties
SETTLEMENT_SCHEDULER_ENABLED=true
SETTLEMENT_CRON_SCHEDULE=0 0 * * *  # Daily at midnight
SETTLEMENT_RUN_ON_INIT=true  # Run immediately on startup
```

Then start the server and it will auto-execute.

### Method 3: Script (Not Working Yet)

The `scripts/invoke-settlement.ts` script has dependency injection issues. It needs the full application context which requires:
- Redis running
- Postgres running  
- Mailpit running
- All environment variables configured

## Current Wallet Addresses (Mainnet)

With the current mnemonic, the mainnet addresses are:

**BSC Mainnet (eip155:56)**:
- Address: `0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3`
- Balance: ~0.00099895 BNB

**Ethereum Mainnet (eip155:1)**:
- Address: `0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3`
- Balance: TBD

**Solana Mainnet (solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp)**:
- Address: TBD
- Balance: TBD

## Binance API Status

The production Binance API keys in `.env` returned a 401 error:
```
Error: Request failed with status code 401
Response: {"code": -2015, "msg": "Invalid API-key, IP, or permissions for action."}
```

**Possible causes:**
1. API keys are invalid/expired
2. IP address not whitelisted
3. Required permissions not enabled ("Enable Reading", "Enable Withdrawals")

**To fix:**
1. Go to https://www.binance.com/en/my/settings/api-management
2. Create new API key or update existing one
3. Enable permissions: "Enable Reading" and "Enable Withdrawals"
4. Add your IP address to whitelist
5. Update `BINANCE_API_KEY` and `BINANCE_API_SECRET` in `.env`

## Next Steps

1. **Fix compilation errors** in `BinanceWalletDepositService`:
   - Update method calls to use correct names
   - Update property access (`.asset` not `.binanceAsset`)
   - Handle null checks properly

2. **Fix module dependency** in `SettlementAdminModule`

3. **Verify Binance API credentials**:
   - Test with `pnpm exec tsx scripts/test-binance-deposit.ts`
   - Should see deposit addresses and balances

4. **Start server and invoke settlement**:
   ```bash
   pnpm start:dev
   # Wait for server to start, then:
   curl -X POST http://localhost:3000/test/settlement/execute-settlement
   ```

## Settlement Configuration

Current settings in `.env`:
```properties
SETTLEMENT_TARGET_PERCENTAGE=50    # Keep 50% in hot wallet, 50% in Binance
SETTLEMENT_MIN_AMOUNT=0.01         # Minimum amount to settle
SETTLEMENT_TARGET_NETWORK=binance  # Settlement target (not used for percentage-based)
```

## Testing on Mainnet ⚠️

**IMPORTANT WARNINGS:**
- Test with small amounts first (0.001 BNB, etc.)
- Verify wallet addresses before sending large amounts
- Monitor transactions on blockchain explorers
- Keep backup of mnemonic phrase secure
- Binance withdrawals can take 10-30 minutes
- Deposits require blockchain confirmations (BSC: 15 blocks ≈ 45 seconds)

## Troubleshooting

If settlement fails:

1. **Check logs** in server console for detailed error messages
2. **Verify balances** using the wallet check script:
   ```bash
   pnpm tsx scripts/check-wallet-addresses.ts
   ```
3. **Check Binance connection**:
   ```bash
   pnpm exec tsx scripts/test-binance-deposit.ts
   ```
4. **Verify database** has currency records with balances
5. **Check settlement logs** table in database for history

## References

- Binance Implementation Summary: `docs/BINANCE_IMPLEMENTATION_SUMMARY.md`
- Binance Settlement Integration: `docs/BINANCE_SETTLEMENT_INTEGRATION.md`
- Wallet Path Migration: `docs/WALLET_PATH_MIGRATION.md`
