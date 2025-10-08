# Binance Exchange Integration for Settlement Module

## Overview

The settlement module now supports **proper Binance Exchange integration** via the official Binance Spot API. This replaces the previous approach of treating Binance as just another blockchain network (BSC).

## Architecture Changes

### Before (Incorrect Approach)
```
Hot Wallets (Ethereum, Polygon, etc.)
         ↓
    Blockchain Transfer
         ↓
BSC Address (eip155:56) ← Treated as "Binance"
```

**Problem**: This approach confused **Binance Smart Chain (BSC)** with **Binance Exchange**. BSC is a blockchain network, while Binance Exchange is a centralized trading platform with off-chain balances.

### After (Correct Approach with API Integration)
```
Hot Wallets (Ethereum, Polygon, etc.)
         ↓
    1. Deposit: Get Binance deposit address via API
         ↓
    Blockchain Transfer to Binance deposit address
         ↓
    Binance Exchange (off-chain balance)
         ↓
    2. Withdraw: Use Binance withdrawal API
         ↓
    Blockchain Transfer to hot wallet addresses
```

## New Components

### 1. BinanceClientService (`binance-client.service.ts`)

Handles all communication with Binance Spot API.

**Key Methods:**
- `getAccountInfo()` - Fetch all account balances
- `getAssetBalance(asset)` - Get balance for specific asset (e.g., 'USDT', 'BTC')
- `getDepositAddress(coin, network)` - Get deposit address for specific network
- `withdraw(coin, address, amount, network)` - Initiate withdrawal to external address
- `getDepositHistory()` - Track deposit transactions
- `getWithdrawalHistory()` - Track withdrawal transactions
- `ping()` - Test API connectivity

**Authentication:**
- Uses HMAC SHA256 signature with API key/secret
- All authenticated requests are signed automatically by the client

### 2. BinanceAssetMapperService (`binance-asset-mapper.service.ts`)

Maps between CryptoGadai token IDs (CAIP-19 format) and Binance asset/network pairs.

**Example Mappings:**
```typescript
// Ethereum USDT → Binance USDT on ETH network
'eip155:1/erc20:0xdac17f958d2ee523a2206206994597c13d831ec7'
  → { asset: 'USDT', network: 'ETH' }

// BSC USDT → Binance USDT on BSC network
'eip155:56/bep20:0x55d398326f99059ff775485246999027b3197955'
  → { asset: 'USDT', network: 'BSC' }

// Solana USDT → Binance USDT on SOL network
'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp/spl-token:Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
  → { asset: 'USDT', network: 'SOL' }
```

**Supported Assets:**
- USDT (ETH, BSC, MATIC, TRX, SOL)
- USDC (ETH, BSC, MATIC, SOL)
- BNB (BSC, ETH)
- ETH (ETH, BSC)
- BTC (ETH/WBTC, BSC/BTCB)
- SOL (SOL, BSC)
- DAI (ETH, BSC, MATIC)

### 3. Updated SettlementService

The settlement service now intelligently handles both Binance API and blockchain approaches:

**Deposit Flow (TO Binance):**
1. Check if Binance API is enabled
2. If enabled: Get deposit address via API
3. If disabled: Fall back to BSC hot wallet address
4. Transfer from hot wallets to deposit address
5. Log results to database

**Withdrawal Flow (FROM Binance):**
1. Check if Binance API is enabled
2. If disabled: Error (cannot withdraw without API)
3. If enabled: Use withdrawal API for each hot wallet
4. Binance processes withdrawal (may take minutes to hours)
5. Log withdrawal IDs to database

## Environment Variables

### Required for Binance API

```bash
# Enable Binance API integration
BINANCE_API_ENABLED=true

# Binance API credentials (from https://www.binance.com/en/my/settings/api-management)
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here

# Optional: Use testnet for development
BINANCE_API_BASE_URL=https://testnet.binance.vision
```

### Existing Settlement Configuration

```bash
# Enable/disable settlement scheduler
SETTLEMENT_ENABLED=true

# Percentage of balance to maintain on Binance (0-100)
SETTLEMENT_PERCENTAGE=50

# Target network (used as fallback if API is disabled)
SETTLEMENT_TARGET_NETWORK=eip155:56
```

## API Key Setup

### Production (Binance.com)

1. Go to https://www.binance.com/en/my/settings/api-management
2. Create new API key
3. **Enable permissions:**
   - ✅ Enable Reading
   - ✅ Enable Withdrawals (required for settlement)
   - ❌ Disable Spot & Margin Trading (not needed)
   - ❌ Disable Futures (not needed)
4. **Whitelist IP addresses** (highly recommended)
5. Copy API Key and Secret Key

### Testnet (for Development)

1. Go to https://testnet.binance.vision/
2. Register for testnet account
3. Generate API key from dashboard
4. Set `BINANCE_API_BASE_URL=https://testnet.binance.vision`

**⚠️ WARNING**: Testnet funds are not real. Do not use testnet keys in production!

## Security Considerations

### API Key Security

1. **Never commit API keys to version control**
   - Use `.env` file (already in `.gitignore`)
   - Use environment variables in production

2. **Restrict API key permissions**
   - Only enable "Enable Reading" and "Enable Withdrawals"
   - Do not enable trading permissions

3. **IP Whitelist** (highly recommended)
   - Add your server IPs to Binance API whitelist
   - Prevents unauthorized access even if keys leak

4. **Use Vault for Production**
   - Store API keys in HashiCorp Vault
   - Rotate keys regularly

### Withdrawal Limits

Binance enforces daily withdrawal limits based on:
- Account verification level
- API key settings
- Security measures (2FA, IP whitelist)

Monitor withdrawal failures and adjust settlement amounts accordingly.

## Settlement Behavior

### Dual-Mode Operation

The settlement module operates in two modes:

**Mode 1: API Enabled** (`BINANCE_API_ENABLED=true`)
- ✅ Accurate balance fetching from Binance exchange
- ✅ Deposits via API-provided addresses
- ✅ Withdrawals via API
- ✅ Deposit/withdrawal history tracking
- ✅ Better error handling and status monitoring

**Mode 2: API Disabled** (`BINANCE_API_ENABLED=false`)
- ⚠️ Falls back to BSC blockchain balance queries
- ⚠️ Deposits to configured BSC address only
- ❌ Withdrawals not supported (requires manual intervention)
- ⚠️ Less accurate balance tracking

### Recommended Configuration

**Production**: Always use API mode for accurate settlement
**Development**: Can use API disabled mode for testing blockchain transfers only

## Balance Calculation

The settlement maintains a **ratio** between hot wallet balances and Binance balances:

```
Target Ratio = SETTLEMENT_PERCENTAGE / 100
```

**Example with 50% ratio:**
- Hot Wallets: 1000 USDT
- Target Binance: 1000 USDT
- Total System: 2000 USDT (50% in hot wallets, 50% on Binance)

**Settlement Actions:**
- If Binance has < 1000 USDT → Deposit difference to Binance
- If Binance has > 1000 USDT → Withdraw excess to hot wallets

## Database Schema

The `settlement_logs` table tracks all settlement operations:

```sql
CREATE TABLE settlement_logs (
  id SERIAL PRIMARY KEY,
  blockchain_key VARCHAR(100) NOT NULL,
  original_balance DECIMAL(32, 18) NOT NULL,
  settlement_amount DECIMAL(32, 18) NOT NULL,
  remaining_balance DECIMAL(32, 18) NOT NULL,
  transaction_hash VARCHAR(255), -- Blockchain txHash or Binance withdrawal ID
  success BOOLEAN NOT NULL,
  error_message TEXT,
  settled_at TIMESTAMP NOT NULL
);
```

**Transaction Hash Field:**
- For deposits: Contains blockchain transaction hash
- For withdrawals: Contains Binance withdrawal ID

## Testing

### Unit Tests

The existing unit tests (`settlement.test.ts`) now mock the Binance services:

```typescript
const mockBinanceClient = {
  isApiEnabled: () => true,
  getAssetBalance: async (asset: string) => ({
    asset,
    free: '100.00',
    locked: '0.00',
  }),
  getDepositAddress: async (coin: string, network: string) => ({
    address: '0xBinanceDepositAddress...',
    coin,
    network,
  }),
};
```

### Integration Testing

To test with actual Binance API:

1. **Use Testnet:**
   ```bash
   BINANCE_API_ENABLED=true
   BINANCE_API_BASE_URL=https://testnet.binance.vision
   BINANCE_API_KEY=testnet_api_key
   BINANCE_API_SECRET=testnet_api_secret
   ```

2. **Test Connectivity:**
   ```typescript
   const canPing = await binanceClient.ping();
   console.log('Binance API accessible:', canPing);
   ```

3. **Test Balance Fetching:**
   ```typescript
   const balance = await binanceClient.getAssetBalance('USDT');
   console.log('Binance USDT balance:', balance);
   ```

4. **Test Deposit Address:**
   ```typescript
   const deposit = await binanceClient.getDepositAddress('USDT', 'BSC');
   console.log('Deposit address:', deposit.address);
   ```

## Error Handling

### Common Errors

**1. API Key Invalid**
```
Error: Invalid API key or signature
Solution: Check BINANCE_API_KEY and BINANCE_API_SECRET
```

**2. IP Not Whitelisted**
```
Error: IP address not whitelisted
Solution: Add server IP to Binance API whitelist
```

**3. Insufficient Permissions**
```
Error: Withdrawal permission not enabled
Solution: Enable "Enable Withdrawals" in API key settings
```

**4. Daily Withdrawal Limit Exceeded**
```
Error: Daily withdrawal limit exceeded
Solution: Wait 24 hours or increase account verification level
```

**5. Unsupported Network**
```
Error: Network not supported for this coin
Solution: Check asset mapper or use different network
```

## Monitoring

### Recommended Monitoring

1. **Settlement Success Rate**
   ```sql
   SELECT 
     COUNT(*) FILTER (WHERE success = true) * 100.0 / COUNT(*) as success_rate
   FROM settlement_logs
   WHERE settled_at > NOW() - INTERVAL '7 days';
   ```

2. **Binance API Health**
   ```typescript
   setInterval(async () => {
     const isHealthy = await binanceClient.ping();
     if (!isHealthy) {
       logger.error('Binance API is down!');
       // Alert operations team
     }
   }, 60000); // Check every minute
   ```

3. **Balance Discrepancies**
   ```typescript
   const hotWalletTotal = await getHotWalletBalances();
   const binanceBalance = await getBinanceBalance(currencyTokenId);
   const ratio = binanceBalance / (hotWalletTotal + binanceBalance);
   
   if (Math.abs(ratio - targetRatio) > 0.05) {
     logger.warn(`Balance ratio off target: ${ratio} vs ${targetRatio}`);
   }
   ```

## Migration Guide

### Migrating from Old Implementation

If you were using the old BSC-only approach:

1. **Set up Binance API credentials**
   ```bash
   BINANCE_API_ENABLED=true
   BINANCE_API_KEY=your_key
   BINANCE_API_SECRET=your_secret
   ```

2. **Test in non-production first**
   - Use testnet to validate integration
   - Monitor settlement logs for errors

3. **Update monitoring/alerts**
   - Add Binance API health checks
   - Monitor withdrawal status

4. **No code changes required**
   - The service automatically uses API when enabled
   - Falls back to BSC if API is disabled

## Future Enhancements

Potential improvements:

1. **Webhook Integration**
   - Listen for Binance deposit confirmations
   - Real-time withdrawal status updates

2. **Multi-Exchange Support**
   - Add support for other exchanges (Coinbase, Kraken, etc.)
   - Abstract exchange interface

3. **Dynamic Network Selection**
   - Automatically choose cheapest network for deposits
   - Factor in gas fees and confirmation times

4. **Advanced Rebalancing**
   - Consider gas costs in settlement decisions
   - Batch small settlements to reduce fees
   - Time settlements based on network congestion

## Troubleshooting

### Issue: "Cannot find module '@binance/connector'"

**Solution:**
```bash
pnpm add @binance/connector
```

### Issue: "Binance API client not initialized"

**Cause:** API disabled or missing credentials

**Solution:**
```bash
# Check environment variables
echo $BINANCE_API_ENABLED
echo $BINANCE_API_KEY

# Enable API and set credentials
export BINANCE_API_ENABLED=true
export BINANCE_API_KEY=your_key
export BINANCE_API_SECRET=your_secret
```

### Issue: Deposits not showing up in Binance

**Cause:** Wrong network or insufficient confirmations

**Solution:**
1. Check transaction on blockchain explorer
2. Verify network matches (BSC vs ETH vs others)
3. Wait for required confirmations (varies by network)
4. Check deposit history:
   ```typescript
   const deposits = await binanceClient.getDepositHistory('USDT');
   console.log(deposits);
   ```

### Issue: Withdrawals failing

**Cause:** Multiple possible reasons

**Checklist:**
- [ ] Withdrawal permission enabled on API key
- [ ] Sufficient balance on Binance
- [ ] Daily withdrawal limit not exceeded
- [ ] Address is valid for selected network
- [ ] Network matches asset (e.g., BEP20 for BSC)
- [ ] 2FA/security verification if required

## References

- **Binance Spot API Docs**: https://binance-docs.github.io/apidocs/spot/en/
- **Official Connector**: https://github.com/binance/binance-connector-node
- **API Key Management**: https://www.binance.com/en/my/settings/api-management
- **Testnet**: https://testnet.binance.vision/

## Support

For issues or questions:
1. Check this documentation
2. Review Binance API error codes
3. Contact DevOps team for production API key issues
4. File issue in project repository for code bugs
