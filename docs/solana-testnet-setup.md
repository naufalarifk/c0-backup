# Solana Testnet Setup for Settlement Testing

This guide explains how to configure the settlement system to use Solana testnet for testing with faucet funds.

## Overview

The settlement system now supports both Solana mainnet and testnet through an environment variable configuration. This allows you to:
1. Get a consistent testnet hot wallet address
2. Request faucet funds for testing
3. Test transfers to Binance testnet

## Configuration

### Environment Variable

Set `SOLANA_USE_TESTNET=true` to use Solana testnet instead of mainnet:

```bash
export SOLANA_USE_TESTNET=true
```

### Blockchain Keys (CAIP-2 Format)

- **Mainnet**: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- **Testnet**: `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z`

### RPC URLs

The system automatically selects the appropriate RPC URL based on the blockchain key:
- **Mainnet**: `https://api.mainnet-beta.solana.com`
- **Testnet**: `https://api.testnet.solana.com`

You can override this by setting `SOLANA_RPC_URL` environment variable.

## Getting Started

### 1. Get Solana Testnet Hot Wallet Address

Run the provided script to get your testnet hot wallet address:

```bash
./scripts/get-solana-testnet-address.sh
```

This will:
- Start a test server with testnet enabled
- Query the Solana hot wallet address
- Display the address for faucet requests
- Stop the server

### 2. Request Faucet Funds

Visit the Solana testnet faucet and request SOL:

**Faucet URL**: https://faucet.solana.com

- Enter your hot wallet address
- Request 1-2 SOL for testing
- Wait for confirmation (usually instant)

### 3. Verify Balance

Start your test server with testnet enabled and check the balance:

```bash
# Start server
export SOLANA_USE_TESTNET=true
./scripts/run-test-server.sh

# In another terminal, query balance
curl http://localhost:<port>/api/test/settlement/solana-balance
```

Expected response:
```json
{
  "success": true,
  "blockchain": "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
  "balance": 1000000000,
  "balanceInSOL": 1,
  "unit": "lamports",
  "address": "<your-address>",
  "network": "testnet",
  "rpcUrl": "https://api.testnet.solana.com",
  "note": "Balance is returned in lamports (1 SOL = 1,000,000,000 lamports)"
}
```

## API Endpoints

### Get Solana Balance
```
GET /api/test/settlement/solana-balance
```

Returns the current Solana hot wallet balance with address information.

### Solana Health Check
```
GET /api/test/settlement/solana-health
```

Verifies that Solana RPC connection is working correctly.

## Code Changes

### SolService (`src/modules/settlement/currencies/sol.service.ts`)

The service now:
- Automatically selects mainnet or testnet based on `SOLANA_USE_TESTNET` env var
- Uses `WalletFactory.getBlockchain()` for consistent hot wallet retrieval
- Provides `getBlockchainKey()` method to query current network
- Auto-detects appropriate RPC URL

Example usage:
```typescript
// Get balance (uses configured network)
const balance = await solService.getBalance();

// Get current blockchain key
const blockchainKey = solService.getBlockchainKey();
// Returns: "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z" (testnet)
//      or: "solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp" (mainnet)
```

### Test Controller

The test controller endpoints dynamically use the configured network:
- `/api/test/settlement/solana-balance` - Returns balance with network info
- `/api/test/settlement/solana-health` - Health check with network info

## Testing Transfer to Binance Testnet

Once you have testnet SOL in your hot wallet:

1. **Configure Binance Testnet** (if not already configured)
   ```bash
   export BINANCE_USE_TESTNET=true
   ```

2. **Run Settlement E2E Tests**
   ```bash
   export SOLANA_USE_TESTNET=true
   export BINANCE_USE_TESTNET=true
   node --import tsx --test test/settlement-e2e.test.ts
   ```

3. **Test Transfer Flow**
   - The settlement system will query Solana testnet balance
   - Calculate required settlement amount
   - Transfer SOL from hot wallet to Binance (if configured)

## Troubleshooting

### Issue: "Insufficient balance" error
**Solution**: Request more SOL from the faucet (up to 2 SOL per request)

### Issue: "Connection refused" to RPC
**Solution**: 
- Check if `SOLANA_RPC_URL` is set correctly
- Try using a different testnet RPC provider:
  ```bash
  export SOLANA_RPC_URL="https://api.devnet.solana.com"
  ```

### Issue: Address keeps changing
**Solution**: 
- The hot wallet address is deterministic based on your wallet configuration
- Make sure `WALLET_SEED` or `WALLET_MNEMONIC` environment variables are consistent
- If using in-memory wallet, the seed is random each time (this is expected for testing)

### Issue: Want to switch back to mainnet
**Solution**:
```bash
unset SOLANA_USE_TESTNET
# or
export SOLANA_USE_TESTNET=false
```

## Production Considerations

⚠️ **Important**: 
- The `SOLANA_USE_TESTNET` flag should **NEVER** be enabled in production
- Production should always use mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`)
- Add validation in your deployment pipeline to ensure this variable is not set

## Reference Implementation

The implementation follows the same pattern as `solana-balance.collector.ts`:
```typescript
// Get hot wallet using WalletFactory.getBlockchain()
const blockchain = this.walletFactory.getBlockchain(SOLANA_BLOCKCHAIN_KEY);
const hotWallet = await blockchain.getHotWallet();
const address = await hotWallet.getAddress();
```

This ensures consistency across the entire codebase for hot wallet retrieval.

## See Also

- Solana Testnet Faucet: https://faucet.solana.com
- Solana Testnet Explorer: https://explorer.solana.com/?cluster=testnet
- Solana Documentation: https://docs.solana.com/
