# Binance Integration - Quick Start Guide

## Overview

The settlement module now integrates with **Binance Exchange** via their official Spot API, enabling automated balance management between blockchain hot wallets and Binance.

## What Changed?

**Before:** Settlement treated "Binance" as just the BSC blockchain (eip155:56)  
**After:** Settlement properly integrates with Binance Exchange API for deposits/withdrawals

## Quick Setup (5 Minutes)

### 1. Get Binance API Keys

**Production:**
1. Go to https://www.binance.com/en/my/settings/api-management
2. Click "Create API"
3. Enable permissions:
   - ✅ Enable Reading
   - ✅ Enable Withdrawals
4. **Important:** Add your server IP to whitelist
5. Copy API Key and Secret

**Testnet (Development):**
1. Go to https://testnet.binance.vision/
2. Register and create API key
3. No real money involved

### 2. Configure Environment Variables

Add to your `.env` file:

```bash
# Enable Binance API
BINANCE_API_ENABLED=true

# Add your credentials
BINANCE_API_KEY=your_api_key_here
BINANCE_API_SECRET=your_api_secret_here

# For testnet only:
# BINANCE_API_BASE_URL=https://testnet.binance.vision
```

### 3. Test Connectivity

```bash
# Start the server
pnpm start:dev

# Check logs for:
# "Binance API client initialized successfully"
```

### 4. Verify Integration (Optional)

```typescript
// In your code or a test script
import { BinanceClientService } from './modules/settlement/binance-client.service';

// Test ping
const canConnect = await binanceClient.ping();
console.log('Connected:', canConnect); // Should be true

// Test balance fetch
const balance = await binanceClient.getAssetBalance('USDT');
console.log('USDT Balance:', balance);
```

## How It Works

### Deposits TO Binance

```
1. Settlement calculates required transfer amount
2. Gets Binance deposit address via API
3. Transfers from hot wallets to deposit address
4. Binance credits balance after confirmations
```

### Withdrawals FROM Binance

```
1. Settlement calculates excess Binance balance
2. Calls Binance withdrawal API
3. Binance processes withdrawal
4. Funds arrive in hot wallet addresses
```

## Configuration Options

### Basic Setup (Recommended)

```bash
SETTLEMENT_ENABLED=true
SETTLEMENT_PERCENTAGE=50
BINANCE_API_ENABLED=true
BINANCE_API_KEY=xxx
BINANCE_API_SECRET=xxx
```

### Advanced Setup

```bash
# Maintain 33% on Binance, 67% in hot wallets
SETTLEMENT_PERCENTAGE=33

# Use different target network for fallback
SETTLEMENT_TARGET_NETWORK=eip155:1  # Ethereum

# Use testnet for development
BINANCE_API_BASE_URL=https://testnet.binance.vision
```

### Disable Binance API (Fallback Mode)

```bash
# Falls back to blockchain-only approach (BSC)
BINANCE_API_ENABLED=false
```

## Supported Assets

The integration supports major cryptocurrencies on multiple networks:

| Asset | Networks Supported |
|-------|-------------------|
| USDT  | ETH, BSC, MATIC, TRX, SOL |
| USDC  | ETH, BSC, MATIC, SOL |
| BNB   | BSC, ETH |
| ETH   | ETH, BSC |
| BTC   | ETH (WBTC), BSC (BTCB) |
| SOL   | SOL, BSC |
| DAI   | ETH, BSC, MATIC |

Network selection is automatic based on the token ID.

## Monitoring

### Check Settlement Logs

```sql
-- View recent settlements
SELECT * FROM settlement_logs 
ORDER BY settled_at DESC 
LIMIT 20;

-- Check success rate
SELECT 
  COUNT(*) FILTER (WHERE success = true) * 100.0 / COUNT(*) as success_rate
FROM settlement_logs
WHERE settled_at > NOW() - INTERVAL '7 days';
```

### Check Binance API Health

The service automatically logs API status:
- ✅ "Binance API client initialized successfully" - All good
- ⚠️ "Binance API credentials not configured" - Missing keys
- ❌ "Failed to fetch Binance account info" - API error

## Troubleshooting

### Problem: "Binance API client not initialized"

**Solution:**
```bash
# Check environment variables are set
echo $BINANCE_API_KEY
echo $BINANCE_API_SECRET

# Restart the application
pnpm start:dev
```

### Problem: "Invalid API key or signature"

**Solution:**
1. Verify API key is copied correctly (no spaces)
2. Verify secret key is correct
3. Check if API key is enabled on Binance
4. Ensure IP is whitelisted if required

### Problem: Deposits not appearing

**Possible causes:**
1. Insufficient blockchain confirmations (wait 5-30 mins)
2. Wrong network selected
3. Minimum deposit amount not met

**Check:**
```typescript
// View deposit history
const deposits = await binanceClient.getDepositHistory('USDT');
console.log(deposits);
```

### Problem: Withdrawals failing

**Checklist:**
- [ ] API key has "Enable Withdrawals" permission
- [ ] Sufficient balance on Binance
- [ ] Daily withdrawal limit not exceeded
- [ ] Address is valid for selected network
- [ ] 2FA completed if required

## Security Best Practices

1. **Never commit API keys to git**
   - Use `.env` file (already in `.gitignore`)
   - Use Vault in production

2. **Enable IP whitelist**
   - Add your server IPs to Binance API settings
   - This prevents unauthorized access

3. **Use least privilege**
   - Only enable "Reading" and "Withdrawals"
   - Do not enable trading

4. **Monitor regularly**
   - Check settlement logs daily
   - Set up alerts for failures
   - Review Binance API usage dashboard

5. **Rotate keys periodically**
   - Recommended: Every 90 days
   - Update in production without downtime

## Advanced Topics

### Testing Deposits

```typescript
// Get deposit address for USDT on BSC
const depositInfo = await binanceClient.getDepositAddress('USDT', 'BSC');
console.log('Send USDT to:', depositInfo.address);

// Check if deposit arrived
const deposits = await binanceClient.getDepositHistory('USDT');
const recent = deposits.filter(d => d.status === 1); // Status 1 = Success
console.log('Recent deposits:', recent);
```

### Testing Withdrawals

```typescript
// Withdraw 10 USDT to BSC address
const withdrawal = await binanceClient.withdraw(
  'USDT',                           // Asset
  '0x1234...5678',                  // Your address
  '10',                             // Amount
  'BSC'                             // Network
);

console.log('Withdrawal ID:', withdrawal.id);

// Check status later
const status = await binanceClient.getWithdrawalStatus(withdrawal.id);
console.log('Status:', status);
```

### Custom Settlement Schedule

Edit `settlement.scheduler.ts`:

```typescript
// Daily at 2 AM
@Cron('0 2 * * *')

// Every 6 hours
@Cron('0 */6 * * *')

// Every Monday at midnight
@Cron('0 0 * * 1')
```

## Documentation

For detailed information, see:

- **BINANCE_INTEGRATION.md** - Complete technical documentation
- **IMPLEMENTATION_SUMMARY.md** - What was implemented
- **.env.template** - Environment variable reference

## Support

1. Check documentation first (BINANCE_INTEGRATION.md)
2. Review Binance API error codes
3. Check settlement logs in database
4. Contact DevOps for production issues

## Next Steps

1. ✅ Install dependencies: `pnpm install`
2. ✅ Build project: `pnpm build`
3. ⬜ Get Binance API keys
4. ⬜ Configure environment variables
5. ⬜ Test on testnet
6. ⬜ Deploy to production
7. ⬜ Set up monitoring

That's it! You're ready to use Binance Exchange integration. 🚀
