# Binance Settlement Integration

This document describes how to use the Binance Wallet API for settlement operations between hot wallets and Binance exchange.

## Overview

The settlement system can now interact with Binance exchange for:
1. **Deposits**: Transfer funds from hot wallet → Binance exchange
2. **Withdrawals**: Transfer funds from Binance exchange → hot wallet
3. **Balance Monitoring**: Check balances on both sides
4. **Transaction Verification**: Verify deposits/withdrawals completed

## Key Components

### 1. BinanceClientService
Low-level Binance API client that handles:
- Account information
- Deposit addresses
- Deposit/withdrawal history
- Withdrawals
- System status

### 2. BinanceWalletDepositService
Service for managing deposits from hot wallet to Binance:
- Get Binance deposit addresses (cached)
- Prepare deposit transactions
- Verify deposits in history
- Monitor balances

### 3. BinanceSettlementService
High-level orchestration service for:
- Complete deposit flow
- Complete withdrawal flow
- Status monitoring
- Balance checks

## How It Works

### Deposit Flow (Hot Wallet → Binance)

```
1. Get Binance deposit address
   ↓
2. Send transaction from hot wallet to deposit address
   ↓
3. Wait for blockchain confirmation
   ↓
4. Binance detects deposit and credits account
   ↓
5. Verify deposit in Binance history
```

**Important**: Binance does NOT provide an API to "push" deposits. Instead:
- You get the deposit address from Binance API
- You send tokens to that address using blockchain transaction
- Binance monitors the blockchain and credits your account automatically
- You verify the deposit using Binance's deposit history API

### Withdrawal Flow (Binance → Hot Wallet)

```
1. Call Binance withdrawal API
   ↓
2. Binance processes withdrawal
   ↓
3. Binance sends transaction on blockchain
   ↓
4. Monitor transaction confirmation
   ↓
5. Verify receipt in hot wallet
```

## Usage Examples

### Example 1: Get Binance Deposit Address

```typescript
import { BinanceSettlementService } from './services/binance/binance-settlement.service';

// Inject in your service/controller
constructor(
  private readonly binanceSettlement: BinanceSettlementService,
) {}

// Get deposit address for BSC (BNB)
const depositAddress = await this.binanceSettlement.getBinanceDepositAddress(
  'BNB_CHAIN',
  'BNB'
);

console.log('Deposit to:', depositAddress.address);
// Output: 0x... (Binance's BSC deposit address)
```

### Example 2: Deposit from Hot Wallet to Binance

```typescript
import { BinanceSettlementService } from './services/binance/binance-settlement.service';
import { WalletService } from '../../shared/wallets/wallet.service';

// 1. Prepare deposit info
const depositInfo = await binanceSettlement.prepareDepositToBinance({
  blockchain: 'BNB_CHAIN',
  asset: 'BNB',
  amount: '0.1',
});

console.log('Send to:', depositInfo.binanceDepositAddress);

// 2. Execute blockchain transaction using WalletService
const txHash = await walletService.sendBscTransaction(
  depositInfo.binanceDepositAddress,
  depositInfo.amount,
);

console.log('Transaction:', txHash);

// 3. Wait for confirmation (optional)
await new Promise(resolve => setTimeout(resolve, 60000)); // Wait 1 minute

// 4. Verify deposit in Binance
const verification = await binanceSettlement.verifyDepositToBinance(
  'BNB',
  '0.1',
  txHash,
  Date.now() - 3600000, // Check last hour
);

console.log('Deposit verified:', verification.verified);
```

### Example 3: Withdraw from Binance to Hot Wallet

```typescript
// Get hot wallet address
const hotWalletAddress = walletService.getHotWalletAddress('BNB_CHAIN');

// Initiate withdrawal
const withdrawal = await binanceSettlement.withdrawFromBinance({
  blockchain: 'BNB_CHAIN',
  asset: 'BNB',
  amount: '0.1',
  toAddress: hotWalletAddress,
});

if (withdrawal.success) {
  console.log('Withdrawal ID:', withdrawal.withdrawalId);
  console.log('Status:', withdrawal.status);

  // Monitor withdrawal status
  const status = await binanceSettlement.checkWithdrawalStatus(
    withdrawal.withdrawalId!
  );
  console.log('Current status:', status.status);
  console.log('Transaction hash:', status.txHash);
}
```

### Example 4: Check Binance Balance

```typescript
const balance = await binanceSettlement.getBinanceBalance('BNB');

console.log(`Free: ${balance.free} BNB`);
console.log(`Locked: ${balance.locked} BNB`);
console.log(`Total: ${balance.total} BNB`);
```

### Example 5: Check Service Status

```typescript
const status = await binanceSettlement.getStatus();

console.log('Binance API Enabled:', status.binanceApiEnabled);
console.log('Binance API Operational:', status.binanceApiOperational);
console.log('Ready for Settlement:', status.readyForSettlement);
```

## Configuration

Add these environment variables to your `.env`:

```bash
# Binance API Configuration
BINANCE_API_ENABLED=true

# Production credentials (used when NODE_ENV=production)
BINANCE_API_KEY=your_production_api_key
BINANCE_API_SECRET=your_production_api_secret

# Test/Development credentials (used when NODE_ENV=development)
BINANCE_TEST_API_KEY=your_test_api_key
BINANCE_TEST_API_SECRET=your_test_api_secret

# Optional: Custom base URL (defaults to https://api.binance.com)
BINANCE_API_BASE_URL=https://api.binance.com
```

### Getting Binance API Keys

1. **For Production**:
   - Log in to https://www.binance.com
   - Go to API Management
   - Create API key with permissions: "Enable Withdrawals", "Enable Reading"

2. **For Testing**:
   - Log in to https://testnet.binance.vision
   - Generate test API keys
   - Note: Testnet only supports `/api` endpoints, not `/sapi` (Wallet API)

## Supported Networks

| Blockchain | Binance Network | Asset Examples |
|-----------|----------------|----------------|
| BNB_CHAIN | BSC | BNB, USDT, BUSD |
| ETHEREUM | ETH | ETH, USDT, USDC |
| SOLANA | SOL | SOL |

## Testing

### Test Script

Run the test script to verify integration:

```bash
pnpm exec tsx scripts/test-binance-deposit.ts
```

This script will:
1. Check Binance API status
2. Get deposit address
3. Check current balance
4. Prepare deposit transaction (but not execute)

### Manual Testing

To test actual deposits:

1. Uncomment the transaction code in `scripts/test-binance-deposit.ts`
2. Ensure you have:
   - Valid Binance API credentials
   - Sufficient balance in hot wallet
   - Small test amount (e.g., 0.001 BNB)
3. Run the script
4. Monitor Binance account for deposit

## Important Notes

### Deposit Addresses

- Deposit addresses are **cached** to avoid repeated API calls
- Same address is used for all deposits of the same asset/network
- Clear cache with `binanceWalletDeposit.clearAddressCache()` if needed

### Transaction Times

- **Deposits**: Typically 1-5 minutes (depends on blockchain confirmations)
- **Withdrawals**: Can take 10-30 minutes (Binance processing + blockchain confirmations)

### Minimum Amounts

Binance has minimum deposit/withdrawal amounts for each asset:
- BNB: Usually 0.001 BNB minimum
- Check Binance documentation for other assets

### Network Fees

- **Deposits**: You pay blockchain gas fees
- **Withdrawals**: Binance deducts withdrawal fee from your balance

### Status Codes

**Deposit Status**:
- `0`: Pending
- `1`: Completed
- `6`: Credited but cannot withdraw
- `7`: Wrong deposit (user needs to return funds)

**Withdrawal Status**:
- `0`: Email Sent
- `1`: Cancelled
- `2`: Awaiting Approval
- `3`: Rejected
- `4`: Processing
- `5`: Failure
- `6`: Completed

## Integration with Settlement

The Binance settlement services integrate with the existing settlement system:

```typescript
// In SettlementService
constructor(
  private readonly binanceSettlement: BinanceSettlementService,
  private readonly walletService: WalletService,
) {}

async rebalanceToExchange(blockchain: string, asset: string, amount: string) {
  // 1. Prepare deposit
  const depositInfo = await this.binanceSettlement.prepareDepositToBinance({
    blockchain,
    asset,
    amount,
  });

  // 2. Send from hot wallet
  const txHash = await this.walletService.sendTransaction({
    blockchain,
    toAddress: depositInfo.binanceDepositAddress,
    amount,
    asset,
  });

  // 3. Log transaction
  await this.settlementTransactionService.logTransaction({
    blockchain,
    txHash,
    amount,
    asset,
    direction: 'TO_EXCHANGE',
  });

  // 4. Verify later (can be done in background job)
  setTimeout(async () => {
    const verified = await this.binanceSettlement.verifyDepositToBinance(
      asset,
      amount,
      txHash,
      Date.now() - 3600000,
    );
    
    if (verified.verified) {
      // Update settlement log status
    }
  }, 120000); // Check after 2 minutes
}
```

## Troubleshooting

### Error: "Binance API client not initialized"
- Check `BINANCE_API_ENABLED=true` in `.env`
- Verify API credentials are set correctly
- Check logs for initialization errors

### Error: "Failed to get deposit address"
- Verify API key has correct permissions
- Check if asset/network is supported by Binance
- Ensure API key is not restricted by IP whitelist

### Deposit not showing in Binance
- Wait for sufficient blockchain confirmations (BSC: 15 blocks)
- Check if sent to correct deposit address
- Verify transaction on blockchain explorer
- Check Binance deposit history manually

### Withdrawal fails
- Verify API key has withdrawal permissions enabled
- Check if withdrawal address is whitelisted (if required)
- Ensure sufficient balance in Binance account
- Check Binance withdrawal limits

## Security Considerations

1. **API Key Security**:
   - Never commit API keys to git
   - Use environment variables
   - Enable IP whitelist in Binance API settings
   - Rotate keys periodically

2. **Withdrawal Safety**:
   - Always verify withdrawal addresses
   - Use address whitelist in Binance
   - Test with small amounts first
   - Monitor all withdrawals

3. **Rate Limits**:
   - Binance has rate limits on API calls
   - The client handles basic rate limiting
   - For high-frequency operations, implement exponential backoff

## References

- [Binance API Documentation](https://binance-docs.github.io/apidocs/spot/en/)
- [Binance Wallet API](https://developers.binance.com/docs/wallet/introduction)
- [Official Binance Node.js SDK](https://github.com/binance/binance-connector-node)
