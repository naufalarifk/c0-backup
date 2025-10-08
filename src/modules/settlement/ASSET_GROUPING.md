# Binance Asset Grouping - Important Implementation Note

## Critical Discovery: How Binance Groups Balances

### The Key Finding

**Binance groups balances by ASSET (currency), NOT by network.**

According to Binance API documentation:
```json
{
  "balances": [
    {
      "asset": "USDT",    // ← All USDT across ALL networks
      "free": "1021.21",
      "locked": "0.00"
    }
  ]
}
```

### What This Means

**Example: USDT**

If you have USDT on multiple networks:
- 100 USDT on Ethereum (ERC-20)
- 100 USDT on BSC (BEP-20)
- 100 USDT on Polygon (MATIC)
- 100 USDT on Solana (SPL)

**Binance shows:** `asset: "USDT", balance: "400"` (combined)

**NOT:** Separate balances per network

### How This Affects Settlement

#### Current Implementation (Needs Adjustment)

```typescript
// Current: Processes each token ID separately
const currencies = ['eip155:1/erc20:0xdac17...', 'eip155:56/bep20:0x55d3...'];

for (const currencyTokenId of currencies) {
  // This treats USDT-ETH and USDT-BSC as different currencies
  await settleCurrency(currencyTokenId);
}
```

**Problem:** Settlement processes USDT on ETH and USDT on BSC separately, but Binance has only ONE USDT balance for both.

#### Correct Approach

Settlement should:
1. **Group by Binance asset** (USDT, USDC, BTC, etc.)
2. **Sum hot wallets across ALL networks** for that asset
3. **Get single Binance balance** for that asset
4. **Calculate settlement** based on combined totals

```typescript
// Correct: Group by asset first
const assetGroups = {
  'USDT': [
    'eip155:1/erc20:0xdac17...',    // ETH
    'eip155:56/bep20:0x55d3...',    // BSC
    'eip155:137/erc20:0xc213...',   // Polygon
  ],
  'USDC': [
    'eip155:1/erc20:0xa0b86...',    // ETH
    'eip155:56/bep20:0x8ac76...',   // BSC
  ]
};

for (const [asset, tokenIds] of Object.entries(assetGroups)) {
  // Calculate total across ALL networks for this asset
  const totalHotWallet = sum(tokenIds.map(id => getBalance(id)));
  
  // Get single Binance balance (covers all networks)
  const binanceBalance = await binanceClient.getAssetBalance(asset);
  
  // Settle based on combined totals
  await settleAsset(asset, tokenIds, totalHotWallet, binanceBalance);
}
```

### Impact on Your Code

#### 1. Settlement Service

**Current flow:**
```
For each currencyTokenId:
  Get hot wallet balances for this specific token
  Get Binance balance (currently per token, incorrectly)
  Calculate settlement for this token alone
```

**Should be:**
```
For each Binance asset (USDT, USDC, etc.):
  Get ALL hot wallet balances for this asset (all networks)
  Get single Binance balance for this asset
  Calculate settlement across ALL networks
  Distribute deposits/withdrawals proportionally
```

#### 2. Asset Mapper

Your `BinanceAssetMapperService` correctly maps tokens → assets:
```typescript
'eip155:1/erc20:0xdac17...'   → { asset: 'USDT', network: 'ETH' }
'eip155:56/bep20:0x55d3...'   → { asset: 'USDT', network: 'BSC' }
```

But settlement needs to **reverse this** and group by asset.

### Recommended Fix

Add a new method to group currencies by Binance asset:

```typescript
// In settlement.service.ts

/**
 * Group currency token IDs by their Binance asset
 * Example: All USDT variants (ETH, BSC, Polygon) → 'USDT'
 */
private groupCurrenciesByAsset(
  currencyTokenIds: string[]
): Map<string, string[]> {
  const assetGroups = new Map<string, string[]>();
  
  for (const tokenId of currencyTokenIds) {
    const mapping = this.binanceMapper.tokenToBinanceAsset(tokenId);
    
    if (!mapping) {
      this.logger.warn(`No Binance mapping for ${tokenId}`);
      continue;
    }
    
    const asset = mapping.asset; // e.g., 'USDT'
    
    if (!assetGroups.has(asset)) {
      assetGroups.set(asset, []);
    }
    
    assetGroups.get(asset)!.push(tokenId);
  }
  
  return assetGroups;
}

/**
 * Settle all hot wallets for a specific Binance asset
 * Handles multiple networks (ETH, BSC, etc.) as one group
 */
async settleAsset(
  asset: string,
  tokenIds: string[],
  ratio: number
): Promise<SettlementResult[]> {
  this.logger.log(`Settling asset: ${asset} across ${tokenIds.length} network(s)`);
  
  // 1. Get hot wallet balances across ALL networks for this asset
  const allHotWallets = [];
  for (const tokenId of tokenIds) {
    const wallets = await this.repository.platformGetsHotWalletBalancesForCurrency(tokenId);
    allHotWallets.push(...wallets);
  }
  
  // 2. Calculate total across all networks
  const totalHotWallet = allHotWallets.reduce(
    (sum, hw) => sum + Number.parseFloat(hw.balance),
    0
  );
  
  this.logger.log(`Total ${asset} in hot wallets: ${totalHotWallet.toFixed(2)}`);
  
  // 3. Get Binance balance (single balance for all networks)
  const binanceBalance = await this.binanceClient.getAssetBalance(asset);
  const currentBinance = binanceBalance
    ? Number.parseFloat(binanceBalance.free) + Number.parseFloat(binanceBalance.locked)
    : 0;
  
  this.logger.log(`Binance ${asset} balance: ${currentBinance.toFixed(2)}`);
  
  // 4. Calculate settlement needed
  const settlementAmount = this.calculateSettlementAmount(
    totalHotWallet.toString(),
    currentBinance.toString(),
    ratio
  );
  
  // 5. Execute settlement
  // ... rest of settlement logic
}

/**
 * Updated main execution method
 */
async executeSettlement(): Promise<SettlementResult[]> {
  // ... existing setup code ...
  
  // Get all currencies
  const currencies = await this.repository.platformGetsCurrenciesWithBalances();
  
  // Group by Binance asset
  const assetGroups = this.groupCurrenciesByAsset(currencies);
  
  this.logger.log(`Processing ${assetGroups.size} asset(s) across ${currencies.length} network(s)`);
  
  const allResults: SettlementResult[] = [];
  
  // Settle each asset (not each currency)
  for (const [asset, tokenIds] of assetGroups) {
    this.logger.log(`--- Settling ${asset} (${tokenIds.join(', ')}) ---`);
    const results = await this.settleAsset(asset, tokenIds, ratio);
    allResults.push(...results);
  }
  
  // ... existing completion code ...
}
```

### Deposit/Withdrawal Strategy

Since Binance has one balance but multiple networks:

**Deposits (TO Binance):**
- Can deposit via ANY supported network
- Recommended: Use network with lowest gas fees
- Consider: Network with most hot wallet balance

**Withdrawals (FROM Binance):**
- Must specify network when withdrawing
- Recommended: Distribute proportionally to hot wallets
- Consider: Gas costs per network

### Example Scenario

**Initial State:**
- Hot Wallets:
  - USDT on ETH: 1000
  - USDT on BSC: 500
  - Total: 1500
- Binance:
  - USDT (all networks): 500

**Settlement Calculation (50% ratio):**
- Target Binance: 1500 (to match hot wallets)
- Need to deposit: 1000 USDT

**Execution:**
- Deposit 666 USDT from ETH (proportional to 1000/1500)
- Deposit 334 USDT from BSC (proportional to 500/1500)
- Result: Binance has 1500 USDT total

**After Settlement:**
- Hot Wallets:
  - USDT on ETH: 334
  - USDT on BSC: 166
  - Total: 500
- Binance:
  - USDT (all networks): 1500

### Testing Checklist

- [ ] Verify USDT on ETH + BSC = combined Binance balance
- [ ] Test deposit to one network updates total balance
- [ ] Test withdrawal from one network updates total balance
- [ ] Verify settlement groups by asset, not by token ID
- [ ] Check proportional distribution across networks

### Documentation Updates Needed

1. **QUICK_START.md** - Add note about asset grouping
2. **BINANCE_INTEGRATION.md** - Explain multi-network balance handling
3. **settlement.service.ts** - Add comments explaining grouping logic

### Next Steps

1. Implement `groupCurrenciesByAsset()` method
2. Create `settleAsset()` method (replaces `settleCurrency()`)
3. Update `executeSettlement()` to use asset grouping
4. Add tests for multi-network scenarios
5. Update documentation

## Summary

✅ **Binance groups by ASSET** (USDT, BTC, etc.)  
❌ **Binance does NOT separate by network**

Your settlement must:
1. Group hot wallet balances by asset (not token ID)
2. Get single Binance balance per asset
3. Settle based on combined totals across all networks

This is a **critical architectural change** needed for correct settlement behavior!
