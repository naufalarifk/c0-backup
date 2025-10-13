# Settlement Module Architecture - Abstract Base Class Pattern

## Overview

Refactored `wallet.abstract.ts` to serve as a proper abstract base class for all settlement blockchain services, following the same pattern as other abstract classes in the codebase.

## Changes Made

### Before (Minimal Abstract Class)

```typescript
export abstract class HotWalletAbstract {
  abstract getBalance(): Promise<string>;
  abstract transfer(toAddress: string, amount: string, options?: any): Promise<string>;
}
```

**Problems:**
- ❌ Too minimal - only 2 methods
- ❌ Not used by existing services
- ❌ No clear pattern for implementation
- ❌ Missing critical settlement operations

### After (Comprehensive Abstract Base Class)

```typescript
export abstract class SettlementBlockchainService {
  // Network Configuration
  abstract getBlockchainKey(): string;
  abstract getNetworkName(): string;
  abstract getRpcUrl(): string;

  // Balance Queries
  abstract getBalance(): Promise<number>;
  abstract getAddressBalance(address: string): Promise<number>;

  // Transaction Operations
  abstract getTransactionStatus(signature: string): Promise<{...}>;
  abstract getTransactionDetails(signature: string): Promise<{...}>;
  abstract waitForConfirmation(signature: string, ...): Promise<{...}>;
  abstract verifyTransfer(signature: string, ...): Promise<{...}>;
  abstract getAddressBalanceChange(signature: string, address: string): Promise<{...}>;
}
```

**Benefits:**
- ✅ Complete interface for blockchain services
- ✅ Enforces consistency across implementations
- ✅ Type-safe method signatures
- ✅ Clear contract for future blockchains
- ✅ Well-documented with JSDoc

## Implementation Pattern

### 1. SolService Now Extends Abstract Class

```typescript
@Injectable()
export class SolService extends SettlementBlockchainService {
  constructor(
    private readonly walletFactory: WalletFactory,
    private readonly walletService: SettlementWalletService,
  ) {
    super();
  }

  // Implements all abstract methods with Solana-specific logic
  getBlockchainKey(): string { ... }
  getNetworkName(): 'mainnet' | 'testnet' | 'devnet' { ... }
  getRpcUrl(): string { ... }
  async getBalance(): Promise<number> { ... }
  // ... all other methods
}
```

### 2. Future Blockchains Follow Same Pattern

#### Example: Ethereum Service (Template)

```typescript
@Injectable()
export class EthService extends SettlementBlockchainService {
  constructor(
    private readonly walletFactory: WalletFactory,
    private readonly walletService: SettlementWalletService,
  ) {
    super();
  }

  getBlockchainKey(): string {
    return 'eip155:1'; // Ethereum mainnet
  }

  getNetworkName(): string {
    return 'mainnet';
  }

  async getBalance(): Promise<number> {
    // Ethereum-specific implementation
    // Returns balance in wei
  }

  // ... implement other abstract methods
}
```

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│       SettlementBlockchainService (Abstract)            │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Network Configuration                             │  │
│  │  - getBlockchainKey()                             │  │
│  │  - getNetworkName()                               │  │
│  │  - getRpcUrl()                                    │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ Balance Queries                                   │  │
│  │  - getBalance()                                   │  │
│  │  - getAddressBalance(address)                     │  │
│  ├───────────────────────────────────────────────────┤  │
│  │ Transaction Operations                            │  │
│  │  - getTransactionStatus(signature)                │  │
│  │  - getTransactionDetails(signature)               │  │
│  │  - waitForConfirmation(signature, ...)            │  │
│  │  - verifyTransfer(signature, from, to, amount)    │  │
│  │  - getAddressBalanceChange(signature, address)    │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        ▲
                        │ extends
        ┌───────────────┼───────────────┬──────────────┬─────────────┐
        │               │               │              │             │
┌───────┴──────┐ ┌──────┴──────┐ ┌─────┴──────┐ ┌────┴─────┐ ┌────┴─────┐
│  SolService  │ │  EthService │ │ BtcService │ │BnbService│ │MoreCoins │
│   (Solana)   │ │  (Ethereum) │ │  (Bitcoin) │ │  (BSC)   │ │  (Future)│
│              │ │              │ │            │ │          │ │          │
│ ✅ Mainnet   │ │ 🔄 Future   │ │ 🔄 Future  │ │ 🔄 Future│ │ 🔄 Future│
│ ✅ Testnet   │ │              │ │            │ │          │ │          │
│ ✅ Devnet    │ │              │ │            │ │          │ │          │
└──────────────┘ └─────────────┘ └────────────┘ └──────────┘ └──────────┘
```

## Benefits

### 1. Type Safety
TypeScript compiler enforces that all abstract methods are implemented:

```typescript
// ❌ Compile Error - Missing methods
export class EthService extends SettlementBlockchainService {
  getBlockchainKey(): string { return 'eip155:1'; }
  // Missing: getNetworkName, getRpcUrl, getBalance, etc.
}
// TypeScript Error: Class 'EthService' incorrectly extends base class
```

### 2. Consistency
All blockchain services have the same interface:

```typescript
// Works with any blockchain service
function getBalanceForBlockchain(service: SettlementBlockchainService) {
  const key = service.getBlockchainKey();
  const network = service.getNetworkName();
  const balance = await service.getBalance();
  return { key, network, balance };
}

// Use with any implementation
const solBalance = await getBalanceForBlockchain(solService);
const ethBalance = await getBalanceForBlockchain(ethService);
```

### 3. Extensibility
Adding new blockchain is straightforward:

1. Create `{blockchain}.service.ts`
2. Extend `SettlementBlockchainService`
3. Implement all abstract methods
4. Register in module
5. Done!

### 4. Documentation
Abstract class serves as API documentation:

```typescript
/**
 * Get transaction status by signature/hash
 * @param signature - Transaction signature or hash
 * @returns Transaction confirmation status and details
 */
abstract getTransactionStatus(signature: string): Promise<{...}>;
```

## Comparison with Other Abstract Classes

This pattern follows the same approach used throughout the codebase:

### Example: Wallet Abstract Class
```typescript
// src/shared/wallets/wallet.abstract.ts
export abstract class Wallet {
  abstract getAddress(): Promise<string>;
  abstract getBalance(address: string): Promise<number>;
  abstract transfer(params: WalletTransferParams): Promise<{ txHash: string }>;
}

// Implementations: EthWallet, SolWallet, BtcWallet, etc.
```

### Example: Blockchain Abstract Class
```typescript
// src/shared/wallets/blockchain.abstract.ts
export abstract class Blockchain {
  abstract getHotWallet(): Promise<Wallet>;
  abstract derivedPathToWallet(derivationPath: string): Promise<Wallet>;
  abstract getInvoiceDerivationPath(invoiceId: number): string;
}

// Implementations: EthMainnetBlockchain, SolMainnetBlockchain, etc.
```

### Our New Pattern: Settlement Blockchain Service
```typescript
// src/modules/settlement/currencies/wallet.abstract.ts
export abstract class SettlementBlockchainService {
  abstract getBlockchainKey(): string;
  abstract getBalance(): Promise<number>;
  abstract getTransactionStatus(signature: string): Promise<{...}>;
  // ... all settlement-specific operations
}

// Implementations: SolService, EthService (future), BtcService (future)
```

## Migration Guide

### For Existing Code
No changes needed! `SolService` now extends the abstract class but maintains backward compatibility.

### For New Blockchains
Follow the template in `src/modules/settlement/currencies/README.md`:

1. Copy template from README
2. Replace blockchain-specific details
3. Implement RPC/SDK logic
4. Add tests
5. Register in module

## Files Modified

1. **`wallet.abstract.ts`**
   - Added `SettlementBlockchainService` abstract class
   - Kept legacy `HotWalletAbstract` as deprecated
   - Comprehensive JSDoc documentation

2. **`sol.service.ts`**
   - Now extends `SettlementBlockchainService`
   - Added `super()` call in constructor
   - All methods already implemented (no changes needed)

3. **`README.md`** (NEW)
   - Complete documentation for blockchain services
   - Template for adding new blockchains
   - Architecture diagrams
   - Implementation checklist

## Testing

All existing tests pass:
- ✅ Build: 0 TypeScript errors
- ✅ Tests: All settlement tests passing
- ✅ Integration: SolService works as before

## Future Work

### Planned Blockchain Services

1. **EthService** (Ethereum)
   - Networks: mainnet, sepolia
   - Balance in wei
   - EIP-1559 transaction support

2. **BtcService** (Bitcoin)
   - Networks: mainnet, testnet
   - Balance in satoshis
   - UTXO-based transactions

3. **BnbService** (BNB Chain)
   - Networks: mainnet, testnet
   - Balance in wei (EVM-compatible)
   - BSC-specific features

### Enhancements

- [ ] Generic blockchain factory pattern
- [ ] Auto-routing based on blockchain key
- [ ] Shared transaction monitoring service
- [ ] Cross-chain transaction support

## Summary

✅ **Transformed** `wallet.abstract.ts` from minimal placeholder to comprehensive abstract base class

✅ **Established** clear pattern for blockchain service implementation

✅ **Updated** `SolService` to extend abstract class (backward compatible)

✅ **Documented** complete architecture with templates and examples

✅ **Maintained** zero TypeScript errors and all tests passing

This architectural improvement makes it easy to add support for Ethereum, Bitcoin, BNB Chain, and any other blockchain to the settlement system while maintaining type safety and consistency! 🚀
