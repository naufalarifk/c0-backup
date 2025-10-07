# Settlement Flow Diagram

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         SETTLEMENT MODULE                             │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐
│  ScheduleModule      │  
│  (@Cron Scheduler)   │  
└──────────┬───────────┘
           │
           │ Triggers at 00:00 UTC daily
           ↓
┌──────────────────────────────────────────────────────────────────────┐
│  SettlementScheduler                                                 │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  handleSettlementCron()                                        │ │
│  │  - Checks SETTLEMENT_ENABLED config                           │ │
│  │  - Logs start of settlement                                   │ │
│  │  - Calls SettlementService.executeSettlement()                │ │
│  │  - Logs results (success count, total amount)                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ↓
┌──────────────────────────────────────────────────────────────────────┐
│  SettlementService                                                   │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  executeSettlement()                                           │ │
│  │  ┌──────────────────────────────────────────────────────────┐ │ │
│  │  │  1. getBlockchainBalances()                              │ │ │
│  │  │     ↓                                                     │ │ │
│  │  │  2. For each blockchain:                                 │ │ │
│  │  │     ├─ calculateSettlementAmount() [50%]                 │ │ │
│  │  │     ├─ settleBlockchainBalance() [ACTUAL TRANSFER]       │ │ │
│  │  │     └─ Collect results                                   │ │ │
│  │  │     ↓                                                     │ │ │
│  │  │  3. storeSettlementResults()                             │ │ │
│  │  └──────────────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ↓
┌──────────────────────────────────────────────────────────────────────┐
│  Database Queries                                                    │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  getBlockchainBalances():                                      │ │
│  │    SELECT blockchain_key,                                      │ │
│  │           currency_token_id,                                   │ │
│  │           SUM(balance) as total_balance                        │ │
│  │    FROM wallet_balances                                        │ │
│  │    WHERE balance > 0                                           │ │
│  │    GROUP BY blockchain_key, currency_token_id                  │ │
│  │                                                                │ │
│  │  storeSettlementResults():                                     │ │
│  │    INSERT INTO settlement_logs (                               │ │
│  │      blockchain_key, original_balance,                         │ │
│  │      settlement_amount, remaining_balance,                     │ │
│  │      transaction_hash, success, error_message                  │ │
│  │    )                                                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ↓
┌──────────────────────────────────────────────────────────────────────┐
│  Blockchain Transfer (The Core)                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  settleBlockchainBalance():                                    │ │
│  │                                                                │ │
│  │  1. Get source hot wallet (from blockchainKey)                │ │
│  │     ↓ WalletService.getHotWallet(blockchainKey)               │ │
│  │     Returns: { address, wallet, blockchainKey }               │ │
│  │                                                                │ │
│  │  2. Get target hot wallet (Binance network)                   │ │
│  │     ↓ WalletService.getHotWallet('eip155:56')                 │ │
│  │     Returns: { address, wallet, blockchainKey }               │ │
│  │                                                                │ │
│  │  3. Execute blockchain transfer                               │ │
│  │     ↓ sourceHotWallet.wallet.transfer({                       │ │
│  │         tokenId: currency,                                    │ │
│  │         from: sourceHotWallet.address,                        │ │
│  │         to: targetHotWallet.address,                          │ │
│  │         value: settlementAmount                               │ │
│  │       })                                                       │ │
│  │     Returns: { txHash: '0x...' }                              │ │
│  │                                                                │ │
│  │  4. Return SettlementResult                                   │ │
│  │     { success: true, transactionHash: '0x...', ... }          │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────┬───────────────────────────────────────────────────────────┘
           │
           ↓
┌──────────────────────────────────────────────────────────────────────┐
│  WalletModule Integration                                            │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  WalletService                                                 │ │
│  │  ├─ getHotWallet(blockchainKey)                               │ │
│  │  │  └─ WalletFactory.getBlockchain(blockchainKey)             │ │
│  │  │     └─ Returns Blockchain provider                         │ │
│  │  │        (EthMainnetBlockchain, BscMainnetBlockchain, etc.)  │ │
│  │  │                                                             │ │
│  │  └─ blockchain.getHotWallet()                                  │ │
│  │     └─ Returns Wallet instance                                │ │
│  │        (EthWallet, BscWallet, etc.)                           │ │
│  │                                                                │ │
│  │  Wallet.transfer()                                             │ │
│  │  ├─ Creates transaction                                        │ │
│  │  ├─ Signs with private key                                    │ │
│  │  ├─ Broadcasts to blockchain                                  │ │
│  │  └─ Returns transaction hash                                  │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘

## Data Flow Example

┌─────────────────────┐
│  Midnight (00:00)   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Cron Trigger: "Settlement started"                             │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Query wallet_balances:                                         │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  eip155:1  | slip44:60  | 10.5 ETH                       │ │
│  │  eip155:56 | slip44:60  | 25.0 BNB                       │ │
│  │  eip155:1  | erc20:usdt | 5000 USDT                      │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Calculate 50% settlements:                                     │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  eip155:1  → 5.25 ETH                                     │ │
│  │  eip155:56 → 12.5 BNB                                     │ │
│  │  eip155:1  → 2500 USDT                                    │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Execute blockchain transfers:                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  Transfer #1:                                             │ │
│  │    From: Ethereum hot wallet (0xabc...)                   │ │
│  │    To:   BSC hot wallet (0xdef...)                        │ │
│  │    Amount: 5.25 ETH                                       │ │
│  │    Result: tx 0x123...                                    │ │
│  │                                                           │ │
│  │  Transfer #2:                                             │ │
│  │    From: BSC hot wallet (0xdef...)                        │ │
│  │    To:   BSC hot wallet (same address)                    │ │
│  │    Amount: 12.5 BNB                                       │ │
│  │    Result: tx 0x456...                                    │ │
│  │                                                           │ │
│  │  Transfer #3:                                             │ │
│  │    From: Ethereum hot wallet (0xabc...)                   │ │
│  │    To:   BSC hot wallet (0xdef...)                        │ │
│  │    Amount: 2500 USDT                                      │ │
│  │    Result: tx 0x789...                                    │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Store to settlement_logs:                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │  blockchain_key | settlement_amount | tx_hash | success  │ │
│  │  ─────────────────────────────────────────────────────────│ │
│  │  eip155:1       | 5.25 ETH         | 0x123   | ✅       │ │
│  │  eip155:56      | 12.5 BNB         | 0x456   | ✅       │ │
│  │  eip155:1       | 2500 USDT        | 0x789   | ✅       │ │
│  └───────────────────────────────────────────────────────────┘ │
└──────────┬──────────────────────────────────────────────────────┘
           │
           ↓
┌─────────────────────────────────────────────────────────────────┐
│  Log completion: "3/3 succeeded, Total: 17.75 + 2500 tokens"   │
└─────────────────────────────────────────────────────────────────┘

## Configuration Flow

┌──────────────────────┐
│  Environment Vars    │
│  ──────────────────  │
│  SETTLEMENT_ENABLED  │ ──┐
│  SETTLEMENT_          │   │
│  PERCENTAGE          │ ──┤
│  SETTLEMENT_TARGET_  │   │
│  NETWORK             │ ──┤
└──────────────────────┘   │
                           │
                           ↓
                  ┌─────────────────┐
                  │  ConfigService  │
                  └────────┬────────┘
                           │
            ┌──────────────┼──────────────┐
            ↓              ↓              ↓
┌────────────────┐  ┌────────────┐  ┌─────────────┐
│ Scheduler      │  │  Service   │  │  Service    │
│ (Enable check) │  │  (%)       │  │  (Network)  │
└────────────────┘  └────────────┘  └─────────────┘

## Error Handling Flow

┌──────────────────────┐
│  Settlement Process  │
└──────────┬───────────┘
           │
           ↓
     [Try Transfer]
           │
      ┌────┴────┐
      │Success? │
      └────┬────┘
           │
     ┌─────┴─────┐
     ↓           ↓
  [YES]        [NO]
     │           │
     ↓           ↓
┌─────────┐  ┌──────────────┐
│ Log     │  │ Catch Error  │
│ Success │  │ Log Failure  │
│ with TX │  │ Store in DB  │
└─────────┘  │ Continue     │
             │ to next      │
             └──────────────┘

## Monitoring & Audit

┌──────────────────────────────────────────────────────────┐
│  settlement_logs table                                   │
│  ──────────────────────────────────────────────────────  │
│  Every settlement is logged:                             │
│  - Original balance                                      │
│  - Settlement amount                                     │
│  - Remaining balance                                     │
│  - Transaction hash (for blockchain explorer)            │
│  - Success/failure status                                │
│  - Error message (if failed)                             │
│  - Timestamp                                             │
│                                                          │
│  Indexes for fast queries:                               │
│  - By blockchain                                         │
│  - By timestamp (most recent first)                      │
│  - Failed settlements only                               │
└──────────────────────────────────────────────────────────┘

## Production Deployment

1. Database Migration
   └─ Apply 0015-settlement.sql
      └─ Creates settlement_logs table

2. Environment Setup
   └─ Set SETTLEMENT_ENABLED=true
   └─ Set SETTLEMENT_PERCENTAGE=50 (or custom)
   └─ Set SETTLEMENT_TARGET_NETWORK=eip155:56

3. Start Worker
   └─ pnpm worker settlement
      └─ Scheduler initializes
         └─ Waits for midnight
            └─ Executes settlement
               └─ Logs to database
                  └─ Waits for next midnight

4. Monitor
   └─ Check settlement_logs table
   └─ Verify transaction hashes on BSCScan
   └─ Watch for failed settlements
   └─ Review settlement amounts
