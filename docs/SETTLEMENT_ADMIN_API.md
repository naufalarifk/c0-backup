# Settlement Admin API

## Overview

The Settlement Admin API provides administrative control over the settlement process, allowing authorized administrators to manually trigger settlement operations outside of the scheduled cron job.

## Endpoint

### POST `/admin/settlement/trigger`

Manually triggers the settlement process between hot wallets and Binance Exchange.

#### Authentication
- **Required**: Yes
- **Type**: Bearer Token (JWT)
- **Role**: Admin only
- **Header**: `Authorization: Bearer <token>`

#### Rate Limiting
- **Limit**: 3 requests per minute
- **Response**: 429 Too Many Requests if exceeded

#### Request

```http
POST /admin/settlement/trigger
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

No request body required.

#### Response

**Success (200 OK)**

```json
{
  "success": true,
  "message": "Settlement triggered successfully",
  "results": [
    {
      "asset": "USDT",
      "success": true,
      "action": "deposit",
      "settlementAmount": "1500.50",
      "fromNetwork": "ETH",
      "toNetwork": "BSC",
      "message": "Successfully deposited 1500.50 USDT from ETH"
    },
    {
      "asset": "USDC",
      "success": true,
      "action": "withdraw",
      "settlementAmount": "2000.00",
      "fromNetwork": "BSC",
      "toNetwork": "MATIC",
      "message": "Successfully withdrew 2000.00 USDC to MATIC"
    },
    {
      "asset": "BNB",
      "success": true,
      "action": "skip",
      "settlementAmount": "0",
      "message": "Already balanced, no action needed"
    }
  ],
  "triggeredBy": "admin@example.com",
  "triggeredAt": "2025-10-08T12:00:00.000Z",
  "summary": {
    "total": 3,
    "succeeded": 3,
    "failed": 0,
    "totalAmount": "3500.50"
  }
}
```

**Error Responses**

```json
// 401 Unauthorized
{
  "statusCode": 401,
  "message": "Unauthorized",
  "error": "Unauthorized"
}

// 429 Rate Limit Exceeded
{
  "statusCode": 429,
  "message": "Too many requests, please try again later",
  "error": "Too Many Requests"
}

// 500 Internal Server Error
{
  "statusCode": 500,
  "message": "Settlement failed: <error details>",
  "error": "Internal Server Error"
}
```

## Response Fields

### Top Level
| Field | Type | Description |
|-------|------|-------------|
| `success` | boolean | Overall success status |
| `message` | string | Human-readable message |
| `results` | array | Array of settlement results per asset |
| `triggeredBy` | string | Email of admin who triggered |
| `triggeredAt` | string (ISO 8601) | Timestamp of trigger |
| `summary` | object | Aggregated summary statistics |

### Result Object
| Field | Type | Description |
|-------|------|-------------|
| `asset` | string | Binance asset symbol (e.g., 'USDT', 'USDC') |
| `success` | boolean | Whether settlement succeeded for this asset |
| `action` | string | Action taken: 'deposit', 'withdraw', or 'skip' |
| `settlementAmount` | string | Amount transferred (decimal string) |
| `fromNetwork` | string | Source network (e.g., 'ETH', 'BSC') |
| `toNetwork` | string | Destination network |
| `message` | string | Detailed result message |

### Summary Object
| Field | Type | Description |
|-------|------|-------------|
| `total` | number | Total number of assets processed |
| `succeeded` | number | Number of successful settlements |
| `failed` | number | Number of failed settlements |
| `totalAmount` | string | Total amount transferred across all assets |

## Use Cases

### 1. Emergency Rebalancing
If market conditions change rapidly, an admin can manually trigger settlement to rebalance hot wallets immediately rather than waiting for the scheduled cron job.

```bash
curl -X POST https://api.example.com/admin/settlement/trigger \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json"
```

### 2. Testing Settlement Logic
After updating settlement configuration or logic, admins can test the settlement process manually.

### 3. Post-Deployment Verification
After deploying new code or configuration changes, verify settlement works correctly by triggering it manually and checking the results.

### 4. Audit Trail
All manual settlements are logged with:
- Timestamp
- Admin email who triggered it
- Complete results for each asset
- Total amounts transferred

Check logs:
```sql
SELECT * FROM settlement_logs 
WHERE metadata->>'triggeredBy' IS NOT NULL 
ORDER BY created_at DESC;
```

## Security Considerations

1. **Admin-Only Access**: Endpoint requires Admin role
2. **Rate Limiting**: Max 3 requests per minute to prevent abuse
3. **Audit Logging**: All manual triggers are logged with admin identity
4. **No Sensitive Data**: Response doesn't expose API keys or secrets
5. **JWT Authentication**: Uses existing Better Auth session management

## Integration with Scheduled Settlement

- **Scheduler**: Runs daily at 00:00 UTC (configured via `SETTLEMENT_CRON_SCHEDULE`)
- **Manual Trigger**: Uses the same `SettlementScheduler.triggerManualSettlement()` method
- **No Conflicts**: Both manual and scheduled settlements use the same logic
- **Idempotent**: Safe to trigger multiple times - will only settle if needed

## Configuration

The settlement process respects these environment variables:

```bash
# Enable/disable entire settlement system
SETTLEMENT_ENABLED=true

# Enable/disable scheduled cron job
SETTLEMENT_SCHEDULER_ENABLED=true

# Cron schedule (default: daily at midnight)
SETTLEMENT_CRON_SCHEDULE="0 0 * * *"

# Run settlement on module initialization
SETTLEMENT_RUN_ON_INIT=false

# Target percentage for Binance balance
SETTLEMENT_TARGET_PERCENTAGE=50

# Target network for settlements (CAIP-2 format)
SETTLEMENT_TARGET_NETWORK=eip155:56

# Minimum amount to trigger settlement
SETTLEMENT_MIN_AMOUNT=100

# Binance API configuration
BINANCE_API_ENABLED=true
BINANCE_API_KEY=your_api_key
BINANCE_API_SECRET=your_api_secret
BINANCE_API_BASE_URL=https://api.binance.com
```

## Example Usage (TypeScript)

```typescript
import axios from 'axios';

async function triggerSettlement(adminToken: string) {
  try {
    const response = await axios.post(
      'https://api.example.com/admin/settlement/trigger',
      {},
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('Settlement triggered successfully');
    console.log(`Total assets processed: ${response.data.summary.total}`);
    console.log(`Succeeded: ${response.data.summary.succeeded}`);
    console.log(`Failed: ${response.data.summary.failed}`);
    console.log(`Total amount: ${response.data.summary.totalAmount}`);
    
    return response.data;
  } catch (error) {
    if (error.response?.status === 429) {
      console.error('Rate limit exceeded, wait 60 seconds');
    } else if (error.response?.status === 401) {
      console.error('Unauthorized - Admin token required');
    } else {
      console.error('Settlement failed:', error.message);
    }
    throw error;
  }
}
```

## Monitoring

### Success Metrics
- Check `summary.succeeded` count
- Verify `totalAmount` is within expected range
- Review individual `results` for each asset

### Failure Handling
- Failed settlements are logged with error details
- Check `summary.failed` count
- Review `results` array for `success: false` entries
- Check application logs for detailed error traces

### Logging
```typescript
// Application logs format
[SettlementController] Manual settlement triggered by admin: admin@example.com
[SettlementScheduler] 🔧 Manual settlement triggered
[SettlementService] Executing settlement for 3 assets
[SettlementController] Manual settlement completed: 3/3 succeeded, Total: 3500.50, Triggered by: admin@example.com
```

## Related Documentation

- [Binance Integration](./BINANCE_INTEGRATION.md) - Technical details of Binance API integration
- [Asset Grouping](./ASSET_GROUPING.md) - How assets are grouped by Binance
- [Testing Guide](./TESTING_COMPLETE.md) - Comprehensive testing documentation
- [Quick Start](./QUICK_START.md) - Setup and configuration guide
