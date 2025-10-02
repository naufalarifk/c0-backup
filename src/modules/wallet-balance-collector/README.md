# Wallet Balance Collector

## Overview

The Wallet Balance Collector module is responsible for collecting remaining balances from invoice wallets and transferring them to the platform's hot wallet after an invoice payment has been detected and recorded.

## Purpose

When customers pay invoices, they may send amounts that are slightly higher than required (due to gas estimation, rounding, etc.), or there may be multiple payments to the same invoice wallet. After an invoice is marked as paid, we need to:

1. Check the remaining balance in the invoice wallet
2. Transfer any remaining balance to the hot wallet
3. Log the collection process for auditing and monitoring

## Architecture

### Components

1. **WalletBalanceCollectorService** - Core service that handles balance checking and transfers
2. **WalletBalanceCollectorQueueService** - Manages the BullMQ queue for balance collection jobs
3. **WalletBalanceCollectorProcessor** - Processes jobs from the queue
4. **WalletBalanceCollectorModule** - NestJS module that ties everything together

### Workflow

```
Invoice Payment Detected
    ↓
Invoice Payment Recorded
    ↓
Balance Collection Job Enqueued
    ↓
Balance Collection Worker Processes Job
    ↓
1. Derive invoice wallet from path
2. Get hot wallet
3. Check balance
4. If balance > 0, transfer to hot wallet
5. Log all operations
```

## Integration

The module integrates with the invoice payment flow:

1. **IndexerService** detects payment and enqueues payment detection job (includes derivation path)
2. **InvoicePaymentProcessor** records the payment in the database
3. **InvoicePaymentProcessor** enqueues balance collection job
4. **WalletBalanceCollectorProcessor** processes the job and collects remaining balance

## Data Flow

### Input (InvoicePaymentJobData)
- `invoiceId`: Invoice identifier
- `blockchainKey`: Blockchain identifier (e.g., 'eip155:1' for Ethereum)
- `walletAddress`: Invoice wallet address
- `walletDerivationPath`: BIP32/BIP44 derivation path
- `transactionHash`: Payment transaction hash
- `amount`: Payment amount

### Output
- Transfers remaining balance to hot wallet
- Logs collection events to telemetry

## Supported Blockchains

Currently implemented:
- ✅ Ethereum (eip155:1)
- ✅ BSC (eip155:56)
- ✅ Ethereum Sepolia Testnet (eip155:11155111)

To be implemented:
- ⏳ Solana
- ⏳ Bitcoin

## Configuration

The module uses the following environment variables:
- `ETHEREUM_RPC_URL` - Ethereum mainnet RPC endpoint
- `BSC_RPC_URL` - BSC mainnet RPC endpoint
- `ETHEREUM_TESTNET_RPC_URL` - Ethereum testnet RPC endpoint
- `SOLANA_RPC_URL` - Solana RPC endpoint (future)
- `BITCOIN_RPC_URL` - Bitcoin RPC endpoint (future)

## Running the Worker

Start the wallet balance collector worker:

```bash
npm run start:wallet-balance-collector
```

Or in development mode:

```bash
npm run start:dev:wallet-balance-collector
```

## Monitoring

The service uses `TelemetryLogger` for all logging, which integrates with OpenTelemetry for observability:

- Balance checks are logged with wallet address and amount
- Successful transfers are logged with transaction hash
- Errors are logged with full context for debugging

## Error Handling

The processor includes:
- **Automatic retries** - Jobs retry up to 5 times with exponential backoff
- **Error logging** - All failures are logged with context
- **Graceful degradation** - If balance is too small or zero, the job completes successfully without transferring

## Gas Handling (Ethereum)

For Ethereum-based chains, the service reserves gas for the transfer transaction:
- Gas reserve: 21000 gas units * 20 gwei = 0.00042 ETH
- Only balances greater than gas reserve are transferred
- Transfer amount = balance - gas reserve

## Security Considerations

1. **Private Keys** - Never logged or exposed in error messages
2. **Wallet Derivation** - Uses secure BIP32/BIP44 derivation
3. **Hot Wallet** - Platform's operational wallet (m/44'/{coinType}'/0'/10/0)
4. **Invoice Wallet** - Unique per invoice (m/44'/{coinType}'/5'/0/{invoiceId})

## Future Enhancements

1. Implement Solana balance collection
2. Implement Bitcoin balance collection
3. Add support for ERC-20 token collection
4. Add support for SPL token collection
5. Optimize gas estimation for Ethereum transfers
6. Add configurable gas reserve thresholds
