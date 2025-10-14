# Multi-Blockchain Settlement: Quick Start Guide

A quick reference for developers working with the multi-blockchain settlement module.

## 🚀 Quick Start

### 1. Import Services

```typescript
import { SolService } from './services/blockchain/sol.service';
import { EthService } from './services/blockchain/eth.service';
import { BscService } from './services/blockchain/bsc.service';
```

### 2. Inject in Constructor

```typescript
@Injectable()
export class YourService {
  constructor(
    private readonly solService: SolService,
    private readonly ethService: EthService,
    private readonly bscService: BscService,
  ) {}
}
```

### 3. Use the Services

```typescript
// Get balance
const balance = await this.ethService.getBalance();

// Verify transaction
const result = await this.ethService.verifyTransfer(
  '0xtxhash...',
  '0xfrom...',
  '0xto...',
  ethers.parseEther('1')
);

// Get transaction for matching
const tx = await this.ethService.getTransactionForMatching('0xtxhash...');
```

## 📋 Available Methods

All blockchain services implement these 11 methods:

| Method | Purpose | Returns |
|--------|---------|---------|
| `getBlockchainKey()` | Get CAIP-2 identifier | `string` |
| `getNetworkName()` | Get network name | `'mainnet' \| 'testnet' \| 'devnet'` |
| `getRpcUrl()` | Get RPC endpoint | `string` |
| `getBalance()` | Get hot wallet balance | `Promise<number>` |
| `getAddressBalance(address)` | Get address balance | `Promise<number>` |
| `getTransactionStatus(sig)` | Check if confirmed | `Promise<{confirmed, success, ...}>` |
| `getTransactionDetails(sig)` | Get full transaction | `Promise<{success, fee, ...}>` |
| `getTransactionForMatching(sig)` | Get matching data | `Promise<{found, amount, ...}>` |
| `waitForConfirmation(sig, ...)` | Wait for confirmation | `Promise<{confirmed, ...}>` |
| `verifyTransfer(sig, from, to, amt)` | Verify transfer | `Promise<{verified, ...}>` |
| `getAddressBalanceChange(sig, addr)` | Get balance change | `Promise<{balanceChange, ...}>` |

## 🌐 Blockchain Keys (CAIP-2)

```typescript
// Solana
'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp' // mainnet-beta
'solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z' // testnet
'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1' // devnet

// Ethereum
'eip155:1'        // mainnet
'eip155:11155111' // sepolia
'eip155:5'        // goerli

// BSC
'eip155:56'  // mainnet
'eip155:97'  // testnet
```

## ⚙️ Environment Variables

```bash
# Solana
SOLANA_USE_DEVNET=false
SOLANA_USE_TESTNET=false
SOLANA_RPC_URL=

# Ethereum
ETH_USE_SEPOLIA=false
ETH_USE_GOERLI=false
ETH_RPC_URL=
INFURA_API_KEY=

# BSC
BSC_USE_TESTNET=false
BSC_RPC_URL=
```

## 💰 Balance Units

| Blockchain | Base Unit | Display Unit | Conversion |
|------------|-----------|--------------|------------|
| Solana | Lamports | SOL | 10^9 lamports = 1 SOL |
| Ethereum | Wei | ETH | 10^18 wei = 1 ETH |
| BSC | Wei | BNB | 10^18 wei = 1 BNB |

```typescript
// Solana
const sol = lamports / LAMPORTS_PER_SOL; // 1000000000 -> 1 SOL

// Ethereum/BSC
const eth = ethers.formatEther(wei); // "1000000000000000000" -> "1.0"
const bnb = ethers.formatEther(wei); // same as ETH
```

## 📝 Common Patterns

### Dynamic Service Selection

```typescript
getServiceByBlockchainKey(key: string): SettlementBlockchainService {
  if (key.startsWith('solana:')) return this.solService;
  if (key === 'eip155:1' || key === 'eip155:11155111' || key === 'eip155:5') {
    return this.ethService;
  }
  if (key === 'eip155:56' || key === 'eip155:97') {
    return this.bscService;
  }
  throw new Error(`Unsupported blockchain: ${key}`);
}
```

### Safe Transaction Verification

```typescript
async safeVerifyTransfer(
  service: SettlementBlockchainService,
  txHash: string,
  from: string,
  to: string,
  amount: number
): Promise<boolean> {
  try {
    const result = await service.verifyTransfer(txHash, from, to, amount);
    
    if (!result.verified && result.errors) {
      this.logger.warn(`Verification failed: ${result.errors.join(', ')}`);
    }
    
    return result.verified && result.success;
  } catch (error) {
    this.logger.error(`Verification error: ${error.message}`);
    return false;
  }
}
```

### Cross-Platform Transaction Matching

```typescript
async matchTransaction(
  blockchainKey: string,
  txHash: string
): Promise<{
  amount: string;
  from: string;
  to: string;
  fee: string;
}> {
  const service = this.getServiceByBlockchainKey(blockchainKey);
  const tx = await service.getTransactionForMatching(txHash);
  
  if (!tx.found) {
    throw new Error('Transaction not found');
  }
  
  if (!tx.confirmed) {
    throw new Error('Transaction not confirmed');
  }
  
  if (!tx.success) {
    throw new Error('Transaction failed');
  }
  
  return {
    amount: tx.amount,  // Already in display units (SOL, ETH, BNB)
    from: tx.from!,
    to: tx.to!,
    fee: tx.fee!,
  };
}
```

### Waiting for Confirmation with Timeout

```typescript
async waitForSettlement(
  service: SettlementBlockchainService,
  txHash: string,
  timeoutSeconds: number = 60
): Promise<boolean> {
  const result = await service.waitForConfirmation(
    txHash,
    'confirmed',
    timeoutSeconds
  );
  
  if (!result.confirmed) {
    if (result.err?.timeout) {
      throw new Error(`Transaction timeout after ${timeoutSeconds}s`);
    }
    return false;
  }
  
  return result.success;
}
```

## 🔧 Testing

### Running Tests

```bash
# Ethereum tests
pnpm test src/modules/settlement/services/blockchain/eth.service.test.ts

# BSC tests
pnpm test src/modules/settlement/services/blockchain/bsc.service.test.ts

# All blockchain service tests
pnpm test src/modules/settlement/services/blockchain/*.test.ts
```

### Mock Services for Testing

```typescript
const mockEthService = {
  getBalance: jest.fn().mockResolvedValue(ethers.parseEther('1')),
  getTransactionStatus: jest.fn().mockResolvedValue({
    confirmed: true,
    success: true,
  }),
  verifyTransfer: jest.fn().mockResolvedValue({
    verified: true,
    success: true,
  }),
  // ... other methods
};
```

## ⚠️ Important Notes

### 1. Balance Unit Consistency
Always convert to base units before calling `verifyTransfer`:
```typescript
// ❌ Wrong
await service.verifyTransfer(txHash, from, to, 1.5);

// ✅ Correct - Solana
await service.verifyTransfer(txHash, from, to, 1.5 * LAMPORTS_PER_SOL);

// ✅ Correct - Ethereum/BSC
await service.verifyTransfer(txHash, from, to, Number(ethers.parseEther('1.5')));
```

### 2. Address Case Sensitivity
- **Solana**: Case-sensitive (Base58)
- **Ethereum/BSC**: Case-insensitive (normalized internally)

### 3. Network Configuration
Network selection happens at **module load time**, not runtime:
```typescript
// ❌ Won't work - network already selected
process.env.ETH_USE_SEPOLIA = 'true';
const service = new EthService(...);  // Still uses mainnet

// ✅ Correct - set before app starts
// Set in .env file or before importing module
```

### 4. Transaction Hash Format
- **Solana**: Base58 string (e.g., `2438ZYtrgSLvDTAcfkpnKxoPbdhpWyfUN3...`)
- **Ethereum/BSC**: Hex string with 0x prefix (e.g., `0x1234abcd...`)

## 📚 Additional Resources

- [MULTI_BLOCKCHAIN_IMPLEMENTATION.md](./MULTI_BLOCKCHAIN_IMPLEMENTATION.md) - Full implementation guide
- [MULTI_BLOCKCHAIN_FINAL_SUMMARY.md](./MULTI_BLOCKCHAIN_FINAL_SUMMARY.md) - Complete summary
- [wallet.abstract.ts](./services/blockchain/wallet.abstract.ts) - Abstract base class
- [sol.service.ts](./services/blockchain/sol.service.ts) - Solana reference implementation

## 🐛 Troubleshooting

### Issue: "Unsupported blockchain"
**Solution**: Check that the blockchain key matches CAIP-2 format and is supported.

### Issue: "Transaction not found"
**Solution**: Verify transaction hash format is correct for the blockchain.

### Issue: "Amount mismatch"
**Solution**: Ensure amount is in base units (lamports/wei), not display units.

### Issue: "RPC endpoint not responding"
**Solution**: Check network configuration and RPC URL in environment variables.

### Issue: "Verification failed - address mismatch"
**Solution**: Ensure addresses are in correct format (Base58 for Solana, hex for ETH/BSC).

## 🎯 Best Practices

1. **Always use try-catch** for blockchain operations
2. **Log verification failures** with detailed error messages
3. **Set reasonable timeouts** for transaction confirmation
4. **Use base units** for amount comparisons
5. **Normalize addresses** before comparison (especially ETH/BSC)
6. **Cache RPC responses** when appropriate to reduce API calls
7. **Monitor RPC rate limits** to avoid throttling
8. **Test with testnets** before using mainnet

---

**Quick Links**:
- [Settlement Module](./settlement.module.ts)
- [Abstract Base](./services/blockchain/wallet.abstract.ts)
- [Solana Service](./services/blockchain/sol.service.ts)
- [Ethereum Service](./services/blockchain/eth.service.ts)
- [BSC Service](./services/blockchain/bsc.service.ts)
