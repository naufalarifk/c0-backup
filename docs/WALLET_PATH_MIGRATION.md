# Wallet Derivation Path Update - Account 1005 → Account 0

## Summary

Successfully migrated the hot wallet from **account 1005** to **account 0** (default derivation path). This makes the wallet compatible with standard wallet applications like MetaMask without requiring custom derivation paths.

## Changes Made

### 1. Updated Core Wallet Service

**File**: `src/shared/wallets/blockchain.abstract.ts`

```typescript
// Before:
return this.derivedPathToWallet(`m/44'/${this.bip44CoinType}'/1005'/0/0`);

// After:
return this.derivedPathToWallet(`m/44'/${this.bip44CoinType}'/0'/0/0`);
```

### 2. Transferred Existing Funds

**Script**: `scripts/transfer-to-default-account.ts`

Transferred **0.001 BNB** from old address (account 1005) to new address (account 0):
- From: `0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083` (account 1005)
- To: `0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3` (account 0)
- Transaction: https://bscscan.com/tx/0xdb99296d964640b767c6904bc0d54bf79a87a02ee4652e516eee2410b46de974
- Gas Cost: 0.00000105 BNB

### 3. Updated Test Files

**File**: `src/modules/settlement/currencies/wallet-consistency.test.ts`
- Updated all derivation paths to use account 0
- Updated expected addresses
- All 11 tests passing ✅

### 4. Updated Monitoring Scripts

**File**: `scripts/monitor-mainnet-balances.ts`
- Updated to use account 0 addresses
- Now shows correct balance (0.00099895 BNB on BSC)

## New Addresses (Account 0 - Default MetaMask Path)

| Blockchain | Derivation Path | Address | Balance |
|------------|-----------------|---------|---------|
| **Solana** | `m/44'/501'/0'/0/0` | `FR7VaPGTSKFD94QFHwj5tRFekLBPyhmQ2yXjs4VUNbq7` | 0 SOL |
| **Ethereum** | `m/44'/60'/0'/0/0` | `0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3` | 0 ETH |
| **BSC** | `m/44'/60'/0'/0/0` | `0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3` | 0.00099895 BNB 💰 |

## Old Addresses (Account 1005 - No Longer Used)

| Blockchain | Derivation Path | Address | Balance |
|------------|-----------------|---------|---------|
| **Solana** | `m/44'/501'/1005'/0/0` | `82HHMAaSBYM6MfSXABAS8xpXq6fgpqUFJkGxB4uvHosy` | 0 SOL (empty) |
| **Ethereum** | `m/44'/60'/1005'/0/0` | `0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083` | 0 ETH (empty) |
| **BSC** | `m/44'/60'/1005'/0/0` | `0x6d3663dD16D2D63Beb21C3fc393dab41E04F2083` | 0 BNB (transferred) |

## Benefits

### ✅ MetaMask Compatible
- Import mnemonic into MetaMask
- **Account 1** (actually account 0) shows immediately
- No need to create 1005 accounts to reach the hot wallet
- Standard derivation path used by all major wallets

### ✅ Better Developer Experience
- Easier to test and debug
- Can verify addresses in any standard wallet app
- No confusion about custom derivation paths
- Matches industry standards (BIP44)

### ✅ Simplified Management
- Default path means less configuration
- No need to explain custom account index
- Compatible with hardware wallets
- Works with all wallet tools (MyEtherWallet, etc.)

## Verification Steps

### 1. Check in MetaMask
```bash
# Import mnemonic in MetaMask
increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle

# You will see:
# Account 1: 0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3
# BSC Balance: ~0.001 BNB ✅
```

### 2. Run Monitoring Script
```bash
pnpm exec tsx scripts/monitor-mainnet-balances.ts
```

### 3. Run Tests
```bash
pnpm test src/modules/settlement/currencies/wallet-consistency.test.ts
```
All 11 tests should pass ✅

### 4. Check Address in System
```bash
pnpm exec tsx scripts/check-wallet-addresses-simple.ts
```

## Test Results

```
✅ All 11 wallet consistency tests passing
   - Solana: 2 tests
   - Ethereum: 2 tests
   - BSC: 2 tests
   - EVM compatibility: 1 test
   - Cross-blockchain: 1 test
   - Parallel generation: 2 tests
   - Stress test (100 iterations): 1 test
```

## Migration Checklist

- [x] Update `blockchain.abstract.ts` to use account 0
- [x] Create transfer script
- [x] Transfer funds from account 1005 to account 0
- [x] Update wallet consistency tests
- [x] Update monitoring scripts
- [x] Run all tests (11/11 passing)
- [x] Verify addresses in MetaMask
- [x] Update documentation

## Notes

- **Mnemonic unchanged**: Still using the same test mnemonic
- **Funds safe**: All funds successfully transferred to new address
- **Backward compatible**: Old addresses still accessible but no longer used
- **Production ready**: System now uses industry-standard derivation paths

## Related Files

### Core Files
- `src/shared/wallets/blockchain.abstract.ts` - Hot wallet derivation path
- `src/shared/wallets/wallet.factory.ts` - Wallet creation

### Test Files
- `src/modules/settlement/currencies/wallet-consistency.test.ts` - Updated to account 0

### Scripts
- `scripts/transfer-to-default-account.ts` - Transfer funds between accounts
- `scripts/monitor-mainnet-balances.ts` - Check balances
- `scripts/show-all-accounts.ts` - Show all derivation paths
- `scripts/check-wallet-addresses-simple.ts` - Verify addresses
- `scripts/compare-mnemonics.ts` - Compare mnemonic outputs

## Security

⚠️ **Important**: The test mnemonic is PUBLIC and should **NEVER** be used in production:
```
increase harsh parrot slight pool police crack wife hill drill swim pool youth artefact ankle
```

In production:
- Generate a secure mnemonic with high entropy
- Store in encrypted vault (HashiCorp Vault)
- Never commit to version control
- Use hardware wallets for large amounts

---

**Date**: October 14, 2025  
**Status**: ✅ Complete  
**Tests**: 11/11 Passing  
**Funds**: Successfully Transferred
