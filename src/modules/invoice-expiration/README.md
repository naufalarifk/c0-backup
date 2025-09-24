# Invoice Expiration Worker

This module provides automated invoice expiration functionality for the CryptoGadai platform.

## Overview

The Invoice Expiration Worker is a background service that:

1. **Runs every 5 minutes** via a cron job
2. **Checks for expired invoices** using the `platformViewsActiveButExpiredInvoices` repository method
3. **Expires qualifying invoices** by updating their status to 'Expired'
4. **Sends notifications** to users about expired invoices

## Architecture

The module follows the same pattern as the notifications module:

- **Service**: `InvoiceExpirationService` - Core business logic
- **Processor**: `InvoiceExpirationProcessor` - BullMQ job processor
- **Queue Service**: `InvoiceExpirationQueueService` - Job scheduling with cron
- **Module**: `InvoiceExpirationModule` - NestJS module configuration
- **Entrypoint**: Separate worker process for dedicated processing

## Key Features

### Automated Scheduling
```typescript
@Cron(CronExpression.EVERY_5_MINUTES)
async handleScheduledInvoiceExpirationCheck(): Promise<void>
```

### Batch Processing
- Processes invoices in configurable batches (default: 100)
- Implements pagination for large datasets
- Includes delays between batches to prevent database overload

### Error Handling
- Continues processing other invoices if individual failures occur
- Logs detailed error information
- Provides comprehensive result reporting

### Notification Integration
- Automatically sends expiration notifications via email
- Uses existing notification infrastructure
- Includes invoice details in notifications

## Usage

### Starting the Worker

```bash
# Development
pnpm start:dev:invoice-expiration

# Production
pnpm start:invoice-expiration
```

### Manual Triggering

```typescript
await invoiceExpirationQueueService.queueInvoiceExpirationCheck({
  type: 'invoice-expiration-check',
  batchSize: 50,
  asOfDate: new Date().toISOString(),
});
```

### Monitoring

```typescript
const status = await invoiceExpirationQueueService.getQueueStatus();
console.log(status); // { waiting: 0, active: 1, completed: 5, failed: 0 }
```

## Configuration

### Environment Variables

The worker uses the same Redis configuration as other workers:

- `REDIS_HOST` - Redis server host (default: localhost)
- `REDIS_PORT` - Redis server port (default: 6379)
- `REDIS_PASSWORD` - Redis password (optional)

### Cron Schedule

The default schedule is every 5 minutes. This can be modified in `InvoiceExpirationQueueService`:

```typescript
@Cron(CronExpression.EVERY_5_MINUTES) // Modify as needed
```

## Database Integration

### Required Repository Methods

The service expects these methods to be available on `FinanceRepository`:

1. **`platformViewsActiveButExpiredInvoices`**
   - Fetches invoices that are active but past due date
   - Supports pagination with limit/offset
   - Returns invoice details with user information

2. **`platformSetActiveButExpiredInvoiceAsExpired`**
   - Updates invoice status to 'Expired'
   - Sets the expiration date
   - Only affects invoices in valid states (Pending, PartiallyPaid, Overdue)

### Query Logic

The service looks for invoices where:
- Status is in: `['Pending', 'PartiallyPaid', 'Overdue']`
- Due date is not null
- Due date is before the current date/time

## Notification Integration

### Email Notifications

When invoices are expired, users receive email notifications with:

- Invoice details (ID, amount, currency, due date)
- Wallet address for reference
- Clear indication that the invoice has expired
- Support contact information

### Notification Composer

The `InvoiceExpiredNotificationComposer` handles:
- Email template generation
- User data integration
- Multi-format support (HTML and plain text)

## Testing

Run the unit tests:

```bash
pnpm test src/modules/invoice-expiration/
```

The tests verify:
- Successful processing of expired invoices
- Error handling for individual invoice failures
- Empty result handling
- Mock validation of repository calls
- Notification queue integration

## Deployment

The worker can be deployed as:

1. **Separate Process** - Dedicated worker instance
2. **Shared Process** - Alongside API or other workers
3. **Container** - Docker container for scalability

### Process Management

For production deployment, use a process manager like PM2:

```json
{
  "apps": [{
    "name": "invoice-expiration-worker",
    "script": "dist/src/entrypoints/invoice-expiration.entrypoint.js",
    "instances": 1,
    "exec_mode": "cluster"
  }]
}
```

## Monitoring & Observability

### Logging

The service provides detailed logging:

- Processing start/completion
- Batch progress
- Individual invoice processing
- Error details with context
- Performance metrics

### Metrics

Key metrics to monitor:

- Processing frequency (should be every 5 minutes)
- Number of invoices processed per run
- Success/failure rates
- Processing duration
- Queue health (waiting/active/failed jobs)

### Alerts

Consider setting up alerts for:

- No processing activity for extended periods
- High failure rates
- Queue backlog growth
- Processing duration spikes

## Future Enhancements

Potential improvements:

1. **Configurable Grace Periods** - Allow different expiration rules per invoice type
2. **Retry Mechanisms** - Retry failed expiration attempts
3. **Batch Size Optimization** - Dynamic batch sizing based on load
4. **Advanced Notifications** - SMS, push notifications, webhooks
5. **Analytics Integration** - Track expiration patterns and trends
6. **Multi-tenant Support** - Handle different expiration rules per organization