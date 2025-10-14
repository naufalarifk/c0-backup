# Verified Wallet Addresses - Settlement System

**Generated:** October 14, 2025  
**Test Mnemonic:** As configured in `test/setup/setup.ts`  
**Status:** ✅ All addresses verified and working

## 🎯 Hot Wallet Addresses

These are the actual hot wallet addresses used in the settlement system:

### Solana
```
Address:    82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy
Path:       m/44'/501'/1005'/0/0
Coin Type:  501
Format:     Base58
Networks:   mainnet-beta, testnet, devnet
```

**Usage in Code:**
```typescript
// All Solana networks use the same address
const solService = app.get(SolService);
const balance = await solService.getBalance();
// Queries: 82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy
```

### Ethereum
```
Address:    0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083
Path:       m/44'/60'/1005'/0/0
Coin Type:  60
Format:     0x + 40 hex characters
Networks:   mainnet (Chain ID 1), sepolia (Chain ID 11155111)
```

**Usage in Code:**
```typescript
const ethService = app.get(EthService);
const balance = await ethService.getBalance();
// Queries: 0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083
```

### Binance Smart Chain
```
Address:    0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083
Path:       m/44'/60'/1005'/0/0
Coin Type:  60
Format:     0x + 40 hex characters
Networks:   mainnet (Chain ID 56), testnet (Chain ID 97)
```

**Usage in Code:**
```typescript
const bscService = app.get(BscService);
const balance = await bscService.getBalance();
// Queries: 0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083
```

> ⚠️ **Note:** ETH and BSC addresses are **identical** (both use coin type 60). This is correct and secure due to different chain IDs.

## 📊 Address Comparison

| Blockchain | Address | Same as |
|------------|---------|---------|
| **Solana** | `82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy` | Unique |
| **Ethereum** | `0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083` | BSC |
| **BSC** | `0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083` | Ethereum |

## 🔐 Test Configuration

From `test/setup/setup.ts`:

```typescript
env: {
  // Platform master mnemonic (for invoice wallets)
  PLATFORM_MASTER_MNEMONIC: 
    'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle',
  
  // Wallet mnemonic (for hot wallets - settlement system)
  WALLET_MNEMONIC: 
    'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle',
  
  // Solana network
  SOLANA_USE_DEVNET: 'true',  // Using devnet for tests
  
  // Binance configuration
  BINANCE_USE_TESTNET: 'true',
  BINANCE_API_ENABLED: 'true',
}
```

> **Note:** Both platform and wallet use the same mnemonic in test environment for simplicity. In production, these should be different.

## 🧪 Verification Steps

### 1. Check Solana Address on Devnet

```bash
# Using Solana CLI
solana balance 82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy --url devnet

# Using curl
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" -d '
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getBalance",
  "params": ["82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy"]
}'
```

**Expected Result:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "context": { "slot": 123456 },
    "value": 5000000000  // 5 SOL in lamports
  },
  "id": 1
}
```

### 2. Check Ethereum Address on Sepolia

```bash
# Using curl
curl https://rpc.sepolia.org -X POST -H "Content-Type: application/json" -d '
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getBalance",
  "params": ["0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083", "latest"]
}'
```

### 3. Check BSC Address on Testnet

```bash
# Using curl
curl https://data-seed-prebsc-1-s1.binance.org:8545 -X POST -H "Content-Type: application/json" -d '
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "eth_getBalance",
  "params": ["0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083", "latest"]
}'
```

## 📝 Settlement Service Integration

All three blockchain services are properly configured to use these addresses:

### SolService
```typescript
// src/modules/settlement/services/blockchain/sol.service.ts
async getBalance(): Promise<number> {
  const blockchain = this.walletFactory.getBlockchain('solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1');
  const hotWallet = await blockchain.getHotWallet();
  const address = await hotWallet.getAddress();
  // address === '82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy'
  
  const publicKey = new PublicKey(address);
  return await this.connection.getBalance(publicKey);
}
```

### EthService
```typescript
// src/modules/settlement/services/blockchain/eth.service.ts
async getBalance(): Promise<number> {
  const blockchain = this.walletFactory.getBlockchain('eip155:11155111');
  const hotWallet = await blockchain.getHotWallet();
  const address = await hotWallet.getAddress();
  // address === '0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083'
  
  return Number(await this.provider.getBalance(address));
}
```

### BscService
```typescript
// src/modules/settlement/services/blockchain/bsc.service.ts
async getBalance(): Promise<number> {
  const blockchain = this.walletFactory.getBlockchain('eip155:97');
  const hotWallet = await blockchain.getHotWallet();
  const address = await hotWallet.getAddress();
  // address === '0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083' (same as ETH)
  
  return Number(await this.provider.getBalance(address));
}
```

## 🔍 Address Validation

### Solana Address Validation
```typescript
import { PublicKey } from '@solana/web3.js';

function isValidSolanaAddress(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

// Test
console.log(isValidSolanaAddress('82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy')); // true
```

### Ethereum/BSC Address Validation
```typescript
import { ethers } from 'ethers';

function isValidEthereumAddress(address: string): boolean {
  return ethers.isAddress(address);
}

// Test
console.log(isValidEthereumAddress('0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083')); // true
```

## 🎯 Test Scenarios

### Scenario 1: Check All Balances
```typescript
const solBalance = await solService.getBalance(); // lamports
const ethBalance = await ethService.getBalance(); // wei
const bscBalance = await bscService.getBalance(); // wei

console.log('Solana:', solBalance / 1e9, 'SOL');
console.log('Ethereum:', ethers.formatEther(ethBalance), 'ETH');
console.log('BSC:', ethers.formatEther(bscBalance), 'BNB');
```

### Scenario 2: Verify Transaction
```typescript
// Solana transaction
const solTx = await solService.getTransactionForMatching('signature...');
console.log('From:', solTx.from); // Should be: 82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy

// Ethereum transaction
const ethTx = await ethService.getTransactionForMatching('0xtxhash...');
console.log('From:', ethTx.from); // Should be: 0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083

// BSC transaction
const bscTx = await bscService.getTransactionForMatching('0xtxhash...');
console.log('From:', bscTx.from); // Should be: 0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083
```

## 🚀 Running Tests

### Check Addresses Programmatically
```bash
# Run the address checker script
pnpm tsx scripts/check-wallet-addresses-simple.ts
```

### Run Settlement Tests
```bash
# All settlement tests
pnpm test test/settlement*.test.ts

# Specific blockchain tests
pnpm test test/settlement-solana-to-binance.test.ts
```

## 📊 Production vs Test Addresses

| Environment | Mnemonic Source | Address Differs |
|-------------|----------------|-----------------|
| **Test** | Hardcoded in `setup.ts` | ❌ No - consistent |
| **Development** | `.env.development` | ✅ Yes - per env |
| **Staging** | Vault/Secrets Manager | ✅ Yes - per env |
| **Production** | Vault/Secrets Manager | ✅ Yes - per env |

> ⚠️ **Production Security:** Never use the test mnemonic in production! Each environment should have unique, securely managed mnemonics.

## ✅ Verification Checklist

- [x] ✅ Solana address derived correctly (`82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy`)
- [x] ✅ Ethereum address derived correctly (`0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083`)
- [x] ✅ BSC address matches Ethereum (EVM-compatible)
- [x] ✅ All addresses use BIP44 standard with account 1005
- [x] ✅ Address derivation is deterministic
- [x] ✅ Addresses verified with test mnemonic from `setup.ts`
- [x] ✅ All services can query balances correctly
- [x] ✅ Transaction verification works with correct addresses

## 📚 Related Documentation

- [WALLET_ADDRESS_GUIDE.md](./WALLET_ADDRESS_GUIDE.md) - Complete address guide
- [MULTI_BLOCKCHAIN_IMPLEMENTATION.md](./MULTI_BLOCKCHAIN_IMPLEMENTATION.md) - Implementation details
- [MULTI_BLOCKCHAIN_QUICK_START.md](./MULTI_BLOCKCHAIN_QUICK_START.md) - Quick reference

## 🔧 Troubleshooting

### Issue: "Address mismatch in tests"
**Solution:** Ensure test setup uses the correct mnemonic:
```typescript
WALLET_MNEMONIC: 'increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle'
```

### Issue: "Cannot query balance"
**Solution:** Check network configuration:
- Solana: Ensure `SOLANA_USE_DEVNET=true`
- Ethereum: Ensure using correct testnet (sepolia/goerli)
- BSC: Ensure `BINANCE_USE_TESTNET=true`

### Issue: "Address format invalid"
**Solution:** Verify address format:
- Solana: Base58, no prefix, 32-44 chars
- Ethereum/BSC: `0x` + 40 hex chars, checksummed

---

**Last Verified:** October 14, 2025  
**Verification Method:** `scripts/check-wallet-addresses-simple.ts`  
**Test Status:** ✅ All addresses working correctly
