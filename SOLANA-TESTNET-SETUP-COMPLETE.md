# ✅ Solana Testnet Configuration - Complete Setup Guide

## 🎯 What We Accomplished

Successfully configured the settlement system to support **Solana testnet** for testing with faucet funds. The system now automatically switches between mainnet and testnet based on environment variable.

## 📋 Changes Made

### 1. **SolService** (`src/modules/settlement/currencies/sol.service.ts`)
- Added support for both Solana mainnet and testnet blockchain keys
- Environment variable control: `SOLANA_USE_TESTNET=true` 
- Automatic RPC URL selection based on network
- New method: `getBlockchainKey()` returns current blockchain key
- **Uses WalletFactory.getBlockchain()** - same pattern as `solana-balance.collector.ts` (line 82-88)

### 2. **SettlementTestController** (`src/modules/settlement/settlement-test.controller.ts`)
- Updated to use dynamic blockchain key from SolService
- Both endpoints now show network info (mainnet/testnet):
  - `/api/test/settlement/solana-balance`
  - `/api/test/settlement/solana-health`

### 3. **Documentation & Scripts**
- Created `docs/solana-testnet-setup.md` - comprehensive guide
- Created `scripts/solana-wallet-info.sh` - helper script
- Created `scripts/get-solana-address.js` - Node.js version

## 🚀 How to Get Your Solana Testnet Hot Wallet Address

### Quick Start

The Solana hot wallet address is **deterministically derived** from your wallet configuration. Here's how to get it:

#### **Option 1: Set a Fixed Mnemonic (RECOMMENDED)**

```bash
# Add to your .env file
WALLET_MNEMONIC="your twelve or twenty four word mnemonic phrase here"
SOLANA_USE_TESTNET=true
```

Then run E2E tests which will display the address:
```bash
SOLANA_USE_TESTNET=true node --import tsx --test test/settlement-e2e.test.ts
```

Look for the "Solana Service Integration" section in the output.

#### **Option 2: Check Dev Server Logs**

Start the dev server and check initialization logs:
```bash
SOLANA_USE_TESTNET=true pnpm start:dev
```

The wallet factory will log the initialized blockchains including Solana testnet.

#### **Option 3: Use Helper Script**

```bash
SOLANA_USE_TESTNET=true ./scripts/solana-wallet-info.sh
```

This provides instructions and configuration info.

## 🔑 Blockchain Keys (CAIP-2 Format)

| Network | Blockchain Key | RPC URL |
|---------|---------------|---------|
| **Mainnet** | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` | `https://api.mainnet-beta.solana.com` |
| **Testnet** | `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z` | `https://api.testnet.solana.com` |

## 💰 Next Steps - Get Faucet Funds

Once you have your testnet hot wallet address:

1. **Visit the Solana testnet faucet**: https://faucet.solana.com
2. **Paste your address**
3. **Request 1-2 SOL** (usually instant)
4. **Verify on explorer**: `https://explorer.solana.com/address/YOUR_ADDRESS?cluster=testnet`

## 🧪 Test the Setup

After receiving faucet funds:

```bash
# Set environment
export SOLANA_USE_TESTNET=true

# Run settlement E2E tests
node --import tsx --test test/settlement-e2e.test.ts
```

Expected: All 16 tests pass, including:
- ✅ Solana Service Integration (3 tests)
- ✅ Settlement Wallet Service (3 tests)
- ✅ Settlement Calculations (3 tests)
- ✅ End-to-End Settlement Flow (2 tests)
- ✅ Error Handling (3 tests)

## 📊 API Endpoints

When using the test server, these endpoints show Solana info:

### Get Balance
```bash
curl http://localhost:PORT/api/test/settlement/solana-balance
```

Response:
```json
{
  "success": true,
  "blockchain": "solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z",
  "balance": 1000000000,
  "balanceInSOL": 1.0,
  "unit": "lamports",
  "address": "YOUR_ADDRESS_HERE",
  "network": "testnet",
  "rpcUrl": "https://api.testnet.solana.com"
}
```

### Health Check
```bash
curl http://localhost:PORT/api/test/settlement/solana-health
```

## ⚙️ Configuration

### Environment Variables

| Variable | Value | Description |
|----------|-------|-------------|
| `SOLANA_USE_TESTNET` | `true` | Use Solana testnet |
| `SOLANA_USE_TESTNET` | `false` or unset | Use Solana mainnet (default) |
| `SOLANA_RPC_URL` | URL | Override RPC URL (optional) |
| `WALLET_MNEMONIC` | "12 or 24 words" | Fixed wallet seed (recommended for consistent address) |

### Example .env

```bash
# Solana Configuration
SOLANA_USE_TESTNET=true
SOLANA_RPC_URL=https://api.testnet.solana.com

# Wallet Configuration (for consistent address)
WALLET_MNEMONIC="your twelve or twenty four word mnemonic phrase here"
```

## 🔍 Troubleshooting

### Issue: Address keeps changing
**Solution**: Set `WALLET_MNEMONIC` in your .env file for a deterministic address

### Issue: Can't find the address in logs
**Solution**: 
1. Run E2E tests with `SOLANA_USE_TESTNET=true`
2. Look for "Solana Service Integration" section
3. Or add console.log in the test file

### Issue: Insufficient balance errors
**Solution**: Request more SOL from faucet (up to 2 SOL per request)

### Issue: RPC connection refused
**Solution**: Try alternative testnet RPC:
```bash
export SOLANA_RPC_URL="https://api.devnet.solana.com"
```

### Issue: Want to switch back to mainnet
**Solution**:
```bash
unset SOLANA_USE_TESTNET
# or
export SOLANA_USE_TESTNET=false
```

## ⚠️ Production Safety

**CRITICAL**: The `SOLANA_USE_TESTNET` flag should **NEVER** be enabled in production!

- Production deployments must use mainnet
- Add CI/CD validation to prevent testnet in production
- The code defaults to mainnet when variable is not set
- Test your deployment pipeline to ensure safety

## 🎓 Technical Details

### Hot Wallet Retrieval Pattern

The implementation follows `solana-balance.collector.ts` (line 82-88):

```typescript
// Get hot wallet using WalletFactory.getBlockchain()
const blockchain = this.walletFactory.getBlockchain(SOLANA_BLOCKCHAIN_KEY);
if (!blockchain) {
  throw new Error(`Unsupported blockchain: ${SOLANA_BLOCKCHAIN_KEY}`);
}
const hotWallet = await blockchain.getHotWallet();
const address = await hotWallet.getAddress();
```

### Blockchain Key Selection

```typescript
const SOLANA_MAINNET_KEY = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const SOLANA_TESTNET_KEY = 'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z';

const SOLANA_BLOCKCHAIN_KEY = process.env.SOLANA_USE_TESTNET === 'true' 
  ? SOLANA_TESTNET_KEY 
  : SOLANA_MAINNET_KEY;
```

### RPC URL Auto-Detection

```typescript
let rpcUrl = process.env.SOLANA_RPC_URL;
if (!rpcUrl) {
  rpcUrl = SOLANA_BLOCKCHAIN_KEY === SOLANA_TESTNET_KEY
    ? 'https://api.testnet.solana.com'
    : 'https://api.mainnet-beta.solana.com';
}
```

## ✅ Test Results

All tests passing (16/16):
```
✅ Get Solana Hot Wallet Address (1/1)
✅ Settlement Wallet Service - Blockchain Integration (3/3)
✅ Settlement Calculations (3/3)
✅ End-to-End Settlement Flow (2/2)
✅ Error Handling and Edge Cases (3/3)
✅ Solana Service Integration (3/3)
✅ Documentation and Verification (1/1)
```

## 📚 References

- **Solana Testnet Faucet**: https://faucet.solana.com
- **Solana Explorer** (testnet): https://explorer.solana.com/?cluster=testnet
- **Solana Documentation**: https://docs.solana.com/
- **CAIP-2 Standard**: https://github.com/ChainAgnostic/CAIPs/blob/master/CAIPs/caip-2.md

## 🎯 Summary

You now have:
- ✅ Solana testnet support via environment variable
- ✅ Consistent hot wallet address (with WALLET_MNEMONIC)
- ✅ API endpoints to check balance and health
- ✅ Full E2E test suite (16/16 passing)
- ✅ Documentation and helper scripts
- ✅ Production safety measures

**Next Step**: Get your hot wallet address using one of the methods above, then request testnet SOL from the faucet!
