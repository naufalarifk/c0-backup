# Settlement Database Implementation

## Overview

This document describes the comprehensive database schema and repository implementation for tracking settlement transactions with per-chain, per-token, and per-Binance-asset details, including full verification records.

## Database Schema

### Tables

#### 1. `settlement_logs`

Primary table for tracking all settlement operations.

**Key Features**:
- Per-chain tracking (blockchain_key)
- Per-token tracking (currency_blockchain_key, currency_token_id)
- Per-Binance-asset tracking (binance_asset, binance_network)
- Transaction details (hash, sender, recipient addresses)
- Status lifecycle (Pending → Sent → Verified/Failed)
- Verification status and details

**Columns**:
```sql
id                      BIGSERIAL PRIMARY KEY
blockchain_key          VARCHAR(64) - Source blockchain (CAIP-2 format)
currency_blockchain_key VARCHAR(64) - Currency blockchain
currency_token_id       VARCHAR(64) - Token ID (CAIP-19 format)
original_balance        DECIMAL(78, 0) - Balance before settlement (smallest unit)
settlement_amount       DECIMAL(78, 0) - Amount transferred (smallest unit)
remaining_balance       DECIMAL(78, 0) - Balance after settlement (smallest unit)
transaction_hash        VARCHAR(255) - Blockchain transaction hash
sender_address          VARCHAR(255) - Hot wallet address
recipient_address       VARCHAR(255) - Binance deposit address
binance_asset           VARCHAR(16) - Binance asset symbol (e.g., BNB, USDT)
binance_network         VARCHAR(16) - Binance network (e.g., BSC, ETH, SOL)
status                  VARCHAR(20) - Pending | Sent | Verified | Failed
success                 BOOLEAN - Transaction send success
error_message           TEXT - Error if failed
settled_at              TIMESTAMP - Settlement initiation time
sent_at                 TIMESTAMP - Transaction sent time
verified_at             TIMESTAMP - Verification completion time
failed_at               TIMESTAMP - Failure time
verified                BOOLEAN - Verification status
verification_error      TEXT - Verification error message
verification_details    JSONB - Detailed verification results
```

**Indexes**:
- `idx_settlement_logs_blockchain` - Query by blockchain
- `idx_settlement_logs_currency` - Query by currency
- `idx_settlement_logs_settled_at` - Query by timestamp
- `idx_settlement_logs_status` - Query by status
- `idx_settlement_logs_verified` - Query by verification status
- `idx_settlement_logs_tx_hash` - Query by transaction hash
- `idx_settlement_logs_failed` - Query failed settlements

#### 2. `settlement_verifications`

Detailed verification records for each settlement with cross-referencing between blockchain and Binance.

**Key Features**:
- Individual verification checks (tx hash, addresses, amounts)
- Binance deposit details (status, confirmations)
- Verification attempt tracking
- Error tracking

**Columns**:
```sql
id                          BIGSERIAL PRIMARY KEY
settlement_log_id           BIGINT - Reference to settlement_logs
blockchain_confirmed        BOOLEAN - Blockchain confirmation status
binance_matched             BOOLEAN - Found in Binance deposit history
amount_matches              BOOLEAN - Amount matches between systems
tx_hash_matches             BOOLEAN - Transaction hash matches
sender_address_matches      BOOLEAN - Sender address verification
recipient_address_matches   BOOLEAN - Recipient address matches
binance_deposit_id          VARCHAR(64) - Binance internal deposit ID
binance_status              VARCHAR(20) - pending | credited | success
binance_confirmations       VARCHAR(16) - Confirmation count (e.g., "12/12")
binance_insert_time         BIGINT - Binance deposit timestamp
overall_matched             BOOLEAN - All checks passed
verification_message        TEXT - Human-readable result
verification_errors         TEXT[] - Array of error messages
verified_at                 TIMESTAMP - Verification timestamp
verification_attempt        INT - Attempt number
```

**Indexes**:
- `idx_settlement_verifications_log_id` - Query by settlement log
- `idx_settlement_verifications_matched` - Query by match status
- `idx_settlement_verifications_verified_at` - Query by timestamp

#### 3. `settlement_reconciliation_reports`

Daily/periodic reconciliation summary reports.

**Key Features**:
- Daily statistics tracking
- Per-currency financial summaries
- Discrepancy tracking

**Columns**:
```sql
id                          BIGSERIAL PRIMARY KEY
report_date                 DATE UNIQUE - Report date
total_deposits              INT - Total deposit count
verified_deposits           INT - Verified deposit count
failed_deposits             INT - Failed deposit count
pending_deposits            INT - Pending deposit count
total_withdrawals           INT - Total withdrawal count (future use)
verified_withdrawals        INT - Verified withdrawal count
failed_withdrawals          INT - Failed withdrawal count
pending_withdrawals         INT - Pending withdrawal count
total_amount_by_currency    JSONB - Financial summary by currency
discrepancy_count           INT - Number of discrepancies
discrepancies               JSONB - Discrepancy details
created_at                  TIMESTAMP - Creation time
updated_at                  TIMESTAMP - Last update time
```

### Views

#### 1. `settlement_logs_with_verification`

Combines settlement logs with verification details for easy querying.

**Usage**:
```sql
SELECT * FROM settlement_logs_with_verification
WHERE status = 'Verified'
ORDER BY settled_at DESC
LIMIT 10;
```

#### 2. `settlement_stats_by_currency`

Aggregated statistics per currency.

**Columns**:
- currency_blockchain_key
- currency_token_id
- currency_symbol
- total_settlements
- verified_count
- failed_count
- pending_count
- total_amount_settled
- total_amount_verified
- first_settlement
- last_settlement

**Usage**:
```sql
SELECT * FROM settlement_stats_by_currency
ORDER BY total_amount_settled DESC;
```

#### 3. `unverified_settlements`

Recent settlements needing attention (last 24 hours).

**Columns**:
- All settlement log fields
- minutes_since_settlement
- verification_attempts

**Usage**:
```sql
SELECT * FROM unverified_settlements
WHERE minutes_since_settlement > 30;
```

### Triggers

#### 1. `update_settlement_status`

Automatically updates settlement_logs status when verification is inserted.

**Behavior**:
- Sets status to 'Verified' if overall_matched = true
- Sets status to 'Failed' after 3 verification attempts
- Updates verified_at timestamp
- Stores verification_details as JSONB

#### 2. `update_reconciliation_report_timestamp`

Auto-updates updated_at on reconciliation report changes.

## Repository Methods

### Settlement Log Operations

#### `platformStoresSettlementResult(params): Promise<string>`

Stores a new settlement log record.

**Parameters**:
```typescript
{
  blockchainKey: string;
  currencyBlockchainKey: string;
  currencyTokenId: string;
  originalBalance: string;
  settlementAmount: string;
  remainingBalance: string;
  transactionHash: string | null;
  senderAddress: string | null;
  recipientAddress: string;
  binanceAsset: string | null;
  binanceNetwork: string | null;
  success: boolean;
  errorMessage: string | null;
  settledAt: Date;
}
```

**Returns**: Settlement log ID

**Example**:
```typescript
const settlementLogId = await repository.platformStoresSettlementResult({
  blockchainKey: 'eip155:56',
  currencyBlockchainKey: 'eip155:56',
  currencyTokenId: 'eip155:56:native',
  originalBalance: '100000000000000000', // 0.1 BNB in wei
  settlementAmount: '50000000000000000',  // 0.05 BNB in wei
  remainingBalance: '50000000000000000',  // 0.05 BNB in wei
  transactionHash: '0xabc123...',
  senderAddress: '0x387B23F37a4A96B87C5f9be7d3E0d7f6E9aF42C3',
  recipientAddress: '0xea118f157fba86ef9b1bb778486242af47254f58',
  binanceAsset: 'BNB',
  binanceNetwork: 'BSC',
  success: true,
  errorMessage: null,
  settledAt: new Date(),
});
```

#### `platformStoresSettlementVerification(params): Promise<string>`

Stores settlement verification details.

**Parameters**:
```typescript
{
  settlementLogId: string;
  blockchainConfirmed: boolean;
  binanceMatched: boolean;
  amountMatches: boolean;
  txHashMatches: boolean;
  senderAddressMatches: boolean;
  recipientAddressMatches: boolean;
  binanceDepositId: string | null;
  binanceStatus: string | null;
  binanceConfirmations: string | null;
  binanceInsertTime: number | null;
  overallMatched: boolean;
  verificationMessage: string;
  verificationErrors: string[];
  verificationAttempt: number;
}
```

**Returns**: Verification record ID

**Example**:
```typescript
const verificationId = await repository.platformStoresSettlementVerification({
  settlementLogId: '123',
  blockchainConfirmed: true,
  binanceMatched: true,
  amountMatches: true,
  txHashMatches: true,
  senderAddressMatches: true,
  recipientAddressMatches: true,
  binanceDepositId: 'binance-deposit-123',
  binanceStatus: 'success',
  binanceConfirmations: '12/12',
  binanceInsertTime: Date.now(),
  overallMatched: true,
  verificationMessage: 'Transaction fully verified',
  verificationErrors: [],
  verificationAttempt: 1,
});
```

### Query Operations

#### `platformGetsSettlementHistory(limit?): Promise<SettlementLogRecord[]>`

Retrieves settlement history with optional limit.

**Parameters**:
- `limit`: number (default: 100) - Maximum records to return

**Returns**: Array of settlement log records

**Example**:
```typescript
const recentSettlements = await repository.platformGetsSettlementHistory(50);
```

#### `platformGetsSettlementLogById(id): Promise<SettlementLogRecord | null>`

Gets a specific settlement log by ID.

**Parameters**:
- `id`: string - Settlement log ID

**Returns**: Settlement log record or null

**Example**:
```typescript
const settlement = await repository.platformGetsSettlementLogById('123');
if (settlement) {
  console.log(`Status: ${settlement.status}`);
}
```

#### `platformGetsUnverifiedSettlements(hours?): Promise<SettlementLogRecord[]>`

Gets settlements that need verification attention.

**Parameters**:
- `hours`: number (default: 24) - Hours to look back

**Returns**: Array of unverified settlements

**Example**:
```typescript
const unverified = await repository.platformGetsUnverifiedSettlements(12);
for (const settlement of unverified) {
  console.log(`Unverified: ${settlement.transactionHash}`);
}
```

## Integration with Settlement Service

The settlement service automatically stores records after each settlement operation:

```typescript
// In SettlementService.storeSettlementResults()
for (const result of results) {
  // 1. Store settlement log
  const settlementLogId = await this.repository.platformStoresSettlementResult({
    // ... settlement details
  });
  
  // 2. Store verification if available
  if (result.verified !== undefined) {
    await this.repository.platformStoresSettlementVerification({
      settlementLogId,
      // ... verification details
    });
  }
}
```

## Data Flow

```
1. Settlement Execution
   ↓
2. Create settlement_logs record (status: Sent)
   ↓
3. Verification Process
   ↓
4. Create settlement_verifications record
   ↓
5. Trigger: update_settlement_status
   ↓
6. Update settlement_logs (status: Verified/Failed)
   ↓
7. Generate reconciliation report (daily)
```

## Querying Examples

### Get all verified settlements today
```sql
SELECT * FROM settlement_logs_with_verification
WHERE DATE(verified_at) = CURRENT_DATE
  AND overall_matched = true
ORDER BY verified_at DESC;
```

### Get statistics by blockchain
```sql
SELECT 
  blockchain_key,
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'Verified') as verified,
  SUM(settlement_amount) as total_amount
FROM settlement_logs
WHERE settled_at > NOW() - INTERVAL '7 days'
GROUP BY blockchain_key;
```

### Find failed settlements with errors
```sql
SELECT 
  sl.transaction_hash,
  sl.blockchain_key,
  sl.error_message,
  sv.verification_errors
FROM settlement_logs sl
LEFT JOIN settlement_verifications sv ON sl.id = sv.settlement_log_id
WHERE sl.status = 'Failed'
ORDER BY sl.settled_at DESC;
```

### Get daily reconciliation summary
```sql
SELECT 
  report_date,
  total_deposits,
  verified_deposits,
  failed_deposits,
  ROUND((verified_deposits::decimal / NULLIF(total_deposits, 0) * 100), 2) as success_rate
FROM settlement_reconciliation_reports
ORDER BY report_date DESC
LIMIT 30;
```

## Migration Notes

The new schema is fully backward compatible. Existing `settlement_logs` data will work with the new fields having NULL values where applicable.

### Migration Steps

1. **Schema Update**: Run `0015-settlement.sql` to create new columns and tables
2. **Data Migration** (if needed): Update existing records with currency and Binance details
3. **Application Update**: Deploy new code with updated repository methods
4. **Verification**: Check that new settlements are being logged correctly

### Rollback Plan

The schema adds new columns and tables without modifying existing data. Rollback can be done by:
1. Reverting to old code
2. Optionally dropping new columns and tables

## Monitoring & Alerts

### Key Metrics to Monitor

1. **Verification Rate**: `verified_deposits / total_deposits`
2. **Average Verification Time**: `verified_at - settled_at`
3. **Failed Settlement Rate**: `failed_deposits / total_deposits`
4. **Pending Settlements**: Count of settlements with status = 'Pending' or 'Sent' > 1 hour old

### Alert Conditions

- Unverified settlements > 30 minutes old
- Verification rate < 95% in last hour
- Failed settlement rate > 5% in last hour
- Any settlement with > 3 verification attempts

## Best Practices

1. **Always use transactions** when inserting related records
2. **Log settlement before verification** to ensure audit trail even if verification fails
3. **Use views for reporting** instead of complex joins in application code
4. **Monitor unverified settlements** regularly
5. **Review reconciliation reports daily**
6. **Set up alerts** for anomalies

## Future Enhancements

1. **Withdrawal Tracking**: Similar tables for withdrawal operations
2. **Auto-retry Logic**: Automatic retry for failed verifications
3. **Real-time Notifications**: Webhook integration for settlement events
4. **Analytics Dashboard**: Pre-computed metrics for faster reporting
5. **Historical Archiving**: Move old records to archive tables

## Related Documentation

- [Settlement Verification Implementation](./SETTLEMENT_VERIFICATION_IMPLEMENTATION.md)
- Repository: `src/shared/repositories/settlement-platform.repository.ts`
- SQL Schema: `src/shared/repositories/postgres/0015-settlement.sql`
- Settlement Service: `src/modules/settlement/services/core/settlement.service.ts`
