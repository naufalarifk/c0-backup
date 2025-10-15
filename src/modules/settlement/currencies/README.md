# Settlement Blockchain Services

This directory contains blockchain-specific services for the settlement system. Each blockchain service implements the `SettlementBlockchainService` abstract class.

## Architecture

### Two-Layer Abstract Pattern

```
┌─────────────────────────────────────────────────────────────────┐
│           LAYER 1: Blockchain Services                          │
│       SettlementBlockchainService (Abstract)                    │
│  - Network configuration and blockchain-level operations        │
│  - Transaction verification and monitoring                      │
│  - Coordinates multiple hot wallets                             │
└─────────────────────────────────────────────────────────────────┘
                        ▲
                        │ extends
        ┌───────────────┼───────────────┬──────────────┐
        │               │               │              │
┌───────┴──────┐ ┌──────┴──────┐ ┌─────┴──────┐ ┌────┴─────┐
│  SolService  │ │  EthService │ │ BtcService │ │BnbService│
│   (Solana)   │ │  (Ethereum) │ │  (Bitcoin) │ │  (BSC)   │
└──────┬───────┘ └──────┬──────┘ └─────┬──────┘ └────┬─────┘
       │                │               │              │
       │ uses           │ uses          │ uses         │ uses
       ▼                ▼               ▼              ▼
┌─────────────────────────────────────────────────────────────────┐
│           LAYER 2: Hot Wallet Instances                         │
│              HotWalletAbstract (Abstract)                       │
│  - Wallet instance operations (balance, transfer, signing)     │
│  - Direct blockchain interaction via wallet SDK                 │
│  - Address and key management                                   │
└─────────────────────────────────────────────────────────────────┘
                        ▲
                        │ implements
        ┌───────────────┼───────────────┬──────────────┐
        │               │               │              │
┌───────┴──────┐ ┌──────┴──────┐ ┌─────┴──────┐ ┌────┴─────┐
│SolHotWallet  │ │EthHotWallet │ │BtcHotWallet│ │BnbHotWlt │
│   (SOL)      │ │   (ETH)     │ │   (BTC)    │ │  (BNB)   │
└──────────────┘ └─────────────┘ └────────────┘ └──────────┘
```

### Relationship Between the Two Layers

**SettlementBlockchainService (Layer 1):**
- High-level blockchain service coordination
- Manages network configuration (mainnet/testnet)
- Orchestrates transaction verification across addresses
- Provides settlement-specific operations
- Example: `SolService` coordinates Solana operations

**HotWalletAbstract (Layer 2):**
- Low-level wallet instance operations
- Holds private keys and signs transactions
- Executes actual blockchain transfers
- Provides wallet-specific utilities
- Example: `SolanaHotWallet` instance for specific hot wallet

**Usage Pattern:**
```typescript
// Layer 1: Blockchain Service
@Injectable()
export class SolService extends SettlementBlockchainService {
  async getBalance(): Promise<number> {
    // Uses Layer 2: Gets hot wallet instance
    const hotWallet = await this.getHotWalletInstance();
    const balance = await hotWallet.getBalance();
    return Number.parseInt(balance);
  }
  
  // Blockchain-level operations
  async verifyTransfer(signature, from, to, amount) {
    // Verify transaction on Solana blockchain
  }
}

// Layer 2: Hot Wallet Instance
export class SolanaHotWallet extends HotWalletAbstract {
  async getBalance(): Promise<string> {
    // Direct blockchain query
    return await this.connection.getBalance(this.publicKey);
  }
  
  async transfer(to: string, amount: string): Promise<string> {
    // Sign and send transaction
    const tx = await this.wallet.sendTransaction(...);
    return tx.signature;
  }
}
```

## Files

### `wallet.abstract.ts`
Contains two abstract base classes for settlement operations:

#### 1. SettlementBlockchainService
Abstract base class that defines the interface all blockchain services must implement:

- **Network Configuration**
  - `getBlockchainKey()` - Get CAIP-2 blockchain identifier
  - `getNetworkName()` - Get network name (mainnet/testnet/devnet)
  - `getRpcUrl()` - Get RPC endpoint URL

- **Balance Queries**
  - `getBalance()` - Get hot wallet balance
  - `getAddressBalance(address)` - Get balance for specific address

- **Transaction Operations**
  - `getTransactionStatus(signature)` - Check transaction confirmation
  - `getTransactionDetails(signature)` - Get full transaction info
  - `waitForConfirmation(signature, commitment, timeout)` - Wait for tx confirmation
  - `verifyTransfer(signature, from, to, amount)` - Verify transfer details
  - `getAddressBalanceChange(signature, address)` - Get balance change in tx

#### 2. HotWalletAbstract
Abstract base class for hot wallet instance operations:

- **Wallet Management**
  - `getAddress()` - Get wallet's blockchain address
  - `getBalance()` - Get balance in smallest unit
  - `getBalanceFormatted()` - Get balance in human-readable format
  - `getBlockchainKey()` - Get CAIP-2 blockchain identifier

- **Transaction Operations**
  - `transfer(toAddress, amount, options)` - Send funds
  - `estimateFee(toAddress, amount)` - Estimate transaction fee
  - `signMessage(message)` - Sign a message with private key

- **Validation**
  - `isValidAddress(address)` - Validate blockchain address
  - `hasSufficientBalance(amount, fee)` - Check if wallet has enough funds

### `sol.service.ts`
Solana blockchain implementation. Supports:
- Multiple networks (mainnet, testnet, devnet)
- Environment-based configuration
- Solana-specific transaction verification
- Lamports-based balance queries

### `wallet.service.ts`
Settlement wallet service that provides balance query methods with logging and error handling.

## Adding a New Blockchain Service

To add support for a new blockchain (e.g., Ethereum, Bitcoin, BNB Chain):

### 1. Create Service File

Create `{blockchain}.service.ts` (e.g., `eth.service.ts`, `btc.service.ts`):

```typescript
import { Injectable } from '@nestjs/common';
import { SettlementBlockchainService } from './wallet.abstract';
import { WalletFactory } from '../../../shared/wallets/wallet.factory';
import { SettlementWalletService } from './wallet.service';

// Blockchain keys (CAIP-2 format)
const ETH_MAINNET_KEY = 'eip155:1';
const ETH_SEPOLIA_KEY = 'eip155:11155111';

// Network selection based on environment
const ETH_BLOCKCHAIN_KEY = 
  process.env.ETH_USE_TESTNET === 'true'
    ? ETH_SEPOLIA_KEY
    : ETH_MAINNET_KEY;

/**
 * Ethereum Settlement Service
 * 
 * Implements settlement operations for Ethereum blockchain.
 * Extends SettlementBlockchainService to provide Ethereum-specific implementations.
 */
@Injectable()
export class EthService extends SettlementBlockchainService {
  constructor(
    private readonly walletFactory: WalletFactory,
    private readonly walletService: SettlementWalletService,
  ) {
    super();
  }

  getBlockchainKey(): string {
    return ETH_BLOCKCHAIN_KEY;
  }

  getNetworkName(): string {
    return ETH_BLOCKCHAIN_KEY === ETH_SEPOLIA_KEY ? 'sepolia' : 'mainnet';
  }

  getRpcUrl(): string {
    return process.env.ETH_RPC_URL || 'https://eth.llamarpc.com';
  }

  async getBalance(): Promise<number> {
    const blockchain = this.walletFactory.getBlockchain(ETH_BLOCKCHAIN_KEY);
    const hotWallet = await blockchain.getHotWallet();
    const address = await hotWallet.getAddress();
    
    // Ethereum-specific balance query logic
    // Return balance in wei
    // ... implementation
  }

  async getAddressBalance(address: string): Promise<number> {
    // Ethereum-specific implementation
  }

  async getTransactionStatus(signature: string): Promise<{
    confirmed: boolean;
    success: boolean;
    blockNumber?: number;
    confirmations?: number | null;
    err?: any;
  }> {
    // Ethereum-specific implementation
  }

  async getTransactionDetails(signature: string): Promise<{
    success: boolean;
    blockTime?: number;
    blockNumber?: number;
    fee?: number;
    // ... other fields
  }> {
    // Ethereum-specific implementation
  }

  async waitForConfirmation(
    signature: string,
    commitment?: string,
    timeoutSeconds: number = 30,
  ): Promise<{
    confirmed: boolean;
    success: boolean;
    blockNumber?: number;
    err?: any;
  }> {
    // Ethereum-specific implementation
  }

  async verifyTransfer(
    signature: string,
    expectedFrom: string,
    expectedTo: string,
    expectedAmount: number,
  ): Promise<{
    verified: boolean;
    success: boolean;
    actualAmount?: number;
    fee?: number;
    from?: string;
    to?: string;
    errors?: string[];
  }> {
    // Ethereum-specific implementation
  }

  async getAddressBalanceChange(
    signature: string,
    address: string,
  ): Promise<{
    balanceChange: number;
    success: boolean;
    found: boolean;
  }> {
    // Ethereum-specific implementation
  }
}
```

### 2. Register in Settlement Module

Update `settlement.module.ts`:

```typescript
import { EthService } from './currencies/eth.service';

@Module({
  providers: [
    // ... existing providers
    SolService,
    EthService, // Add new service
    // ...
  ],
  exports: [
    // ... existing exports
    SolService,
    EthService, // Export new service
    // ...
  ],
})
export class SettlementModule {}
```

### 3. Use in Settlement Services

Inject and use in controllers or services:

```typescript
@Controller('settlement')
export class SettlementController {
  constructor(
    private readonly solService: SolService,
    private readonly ethService: EthService, // Inject new service
  ) {}

  @Post('balance/:blockchain')
  async getBalance(@Param('blockchain') blockchain: string) {
    // Route to appropriate service based on blockchain
    switch (blockchain) {
      case 'solana':
        return await this.solService.getBalance();
      case 'ethereum':
        return await this.ethService.getBalance();
      // ... other blockchains
    }
  }
}
```

## Benefits of This Architecture

1. **Type Safety**: TypeScript ensures all methods are implemented
2. **Consistency**: All blockchain services have the same interface
3. **Extensibility**: Easy to add new blockchains without modifying existing code
4. **Testability**: Each service can be tested independently
5. **Maintainability**: Clear separation of blockchain-specific logic

## Implementation Checklist

When implementing a new blockchain service:

- [ ] Extend `SettlementBlockchainService`
- [ ] Implement all abstract methods
- [ ] Add blockchain-specific error handling
- [ ] Support multiple networks (mainnet/testnet)
- [ ] Add comprehensive JSDoc comments
- [ ] Create integration tests
- [ ] Update module providers and exports
- [ ] Document environment variables needed
- [ ] Add to settlement controller/services

## Example: Solana Service

See `sol.service.ts` for a complete reference implementation that:
- ✅ Extends `SettlementBlockchainService`
- ✅ Implements all required methods
- ✅ Supports mainnet, testnet, devnet
- ✅ Has comprehensive error handling
- ✅ Well-documented with JSDoc
- ✅ Used in settlement operations

## Testing

Each blockchain service should have:
1. **Unit tests** - Mock dependencies, test logic
2. **Integration tests** - Test with real blockchain connections (testnet)
3. **E2E tests** - Test full settlement flow

Example test file: `sol-service.test.ts`

## Environment Variables

Each blockchain service typically needs:

```bash
# Solana
SOLANA_USE_DEVNET=true|false
SOLANA_USE_TESTNET=true|false
SOLANA_RPC_URL=https://api.devnet.solana.com

# Ethereum (future)
ETH_USE_TESTNET=true|false
ETH_RPC_URL=https://eth.llamarpc.com

# Bitcoin (future)
BTC_USE_TESTNET=true|false
BTC_RPC_URL=...
```

## Related Documentation

- [Settlement Module Overview](../README.md)
- [Wallet Service Documentation](./wallet.service.ts)
- [Settlement API Spec](../../../docs/SETTLEMENT_ADMIN_API.md)
