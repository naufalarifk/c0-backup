# Notifications Module E2E Testing Guide

This guide provides comprehensive information about the end-to-end testing strategy implemented for the notifications module.

## Overview

The notification system E2E tests verify the complete flow from job queuing through to actual notification delivery across all supported channels (Email, SMS, FCM, APNS).

## Test Architecture

### Test Structure
```
test/e2e/notifications/
├── notification-queue.e2e-spec.ts      # Queue operations and job lifecycle
├── email-notifications.e2e-spec.ts     # Email notification delivery
├── push-notifications.e2e-spec.ts      # FCM and APNS notifications
├── sms-notifications.e2e-spec.ts       # SMS notification delivery
├── notification-flow.e2e-spec.ts       # End-to-end notification flows
└── notification-bulk.e2e-spec.ts       # Bulk processing and performance
```

### Test Infrastructure

#### TestContainers Setup
- **PostgreSQL**: Database for user data and repositories
- **Redis**: BullMQ queue persistence and job management
- **Mailpit**: SMTP server for email testing

#### Mock Providers
- **FCM**: Mocked with call tracking (no actual push notifications)
- **APNS**: Mocked with call tracking (no actual push notifications)  
- **Twilio SMS**: Mocked with call tracking (no actual SMS sending)

## Test Categories

### 1. Queue Operations (`notification-queue.e2e-spec.ts`)

**Purpose**: Test BullMQ integration and job lifecycle management

**Key Tests**:
- Job queuing and priority handling
- Job processing with progress tracking
- Retry mechanisms and backoff strategies
- Queue statistics and monitoring
- Job persistence across restarts
- Error handling and recovery

**Example**:
```typescript
it('should process notification job successfully', async () => {
  await notificationQueueService.queueNotification(notificationData);
  
  const job = await new Promise<Job>((resolve) => {
    notificationQueue.on('completed', resolve);
  });
  
  expect(job.finishedOn).toBeDefined();
});
```

### 2. Email Notifications (`email-notifications.e2e-spec.ts`)

**Purpose**: Test email delivery through Mailpit container

**Key Tests**:
- Welcome emails for user registration
- Email verification notifications
- Password reset emails
- HTML and text content formatting
- Special character handling
- Email headers and metadata
- Bulk email processing efficiency

**Email Verification**:
```typescript
// Wait for email delivery
await new Promise((resolve) => setTimeout(resolve, 3000));

// Verify email received
const messages = await MailpitHelper.getAllMessages();
const welcomeEmail = messages.find(msg => 
  msg.To?.[0]?.Address === testEmail &&
  msg.Subject?.includes('Welcome')
);

expect(welcomeEmail).toBeDefined();
```

### 3. Push Notifications (`push-notifications.e2e-spec.ts`)

**Purpose**: Test FCM and APNS notification composition and delivery

**Key Tests**:
- FCM notification payload structure
- APNS notification with badges and sounds
- Multi-platform notifications (FCM + APNS)
- Custom data payloads
- Priority and urgency handling
- Error handling for provider failures

**Mock Verification**:
```typescript
// Mock tracking setup
jest.spyOn(fcmProvider, 'send').mockImplementation(async (notification) => {
  mockFCMCalls.push(notification);
});

// Verify mock calls
expect(mockFCMCalls).toHaveLength(1);
expect(mockFCMCalls[0]).toMatchObject({
  to: deviceToken,
  title: expect.stringContaining('Alert'),
});
```

### 4. SMS Notifications (`sms-notifications.e2e-spec.ts`)

**Purpose**: Test SMS delivery through Twilio service mock

**Key Tests**:
- Authentication SMS (2FA codes)
- Security alerts for suspicious activity
- Financial notifications (payments, loans)
- KYC verification status updates
- Phone number formatting validation
- SMS content length constraints
- Error handling for invalid numbers

### 5. Notification Flows (`notification-flow.e2e-spec.ts`)

**Purpose**: Test complete end-to-end notification workflows

**Key Tests**:
- User registration → welcome email flow
- Multi-channel notifications (email + SMS + push)
- Error recovery and retry mechanisms
- Composer and provider integration
- Concurrent notification processing
- Invalid notification type handling

**Complete Flow Test**:
```typescript
it('should process complete user registration notification flow', async () => {
  // 1. Queue notification
  await notificationQueueService.queueNotification(notificationData);
  
  // 2. Wait for job processing
  const processedJob = await waitForJobCompletion(testUserId);
  
  // 3. Verify email delivery
  const messages = await MailpitHelper.getAllMessages();
  expect(messages.find(msg => msg.To[0].Address === testEmail)).toBeDefined();
});
```

### 6. Bulk Processing (`notification-bulk.e2e-spec.ts`)

**Purpose**: Test performance and scalability under load

**Key Tests**:
- Large-scale email processing (50+ notifications)
- Multi-channel bulk notifications
- Priority-based processing order
- Queue backpressure handling
- Partial failure recovery
- Performance metrics and timing

**Performance Testing**:
```typescript
it('should handle 50 simultaneous notifications efficiently', async () => {
  const startTime = Date.now();
  
  await Promise.all(notifications.map(n => 
    notificationQueueService.queueNotification(n)
  ));
  
  await waitForAllJobsCompletion(50);
  
  const processingTime = Date.now() - startTime;
  expect(processingTime).toBeLessThan(45000); // 45 seconds
});
```

## Test Utilities

### NotificationTestHelper

Comprehensive helper class providing:

- **Job Waiting**: `waitForJobsToComplete(queue, count, timeout)`
- **Progress Tracking**: `waitForJobsWithProgress(queue, count)`
- **Test Data Generation**: `generateTestNotificationData(type, index)`
- **Bulk Data Creation**: `generateBulkTestNotifications(count, types)`
- **Queue Management**: `cleanQueue(queue)`
- **Performance Measurement**: `measurePerformance(operation)`
- **Batch Operations**: `executeBatch(items, operation, batchSize)`

## Best Practices

### 1. Test Isolation
- Clean queue state before each test
- Clear email messages between tests
- Reset mock call counters
- Use unique test data (timestamps, user IDs)

### 2. Async Handling
- Use proper Promise patterns for job completion
- Implement timeouts to prevent hanging tests
- Handle both success and failure scenarios

### 3. Real Integration
- Use actual containers (Redis, PostgreSQL, Mailpit)
- Test real job processing, not just queuing
- Verify actual email delivery through SMTP

### 4. Error Scenarios
- Test provider failures and recovery
- Validate retry mechanisms
- Check partial failure handling in bulk operations

### 5. Performance Testing
- Measure processing times
- Test under realistic load
- Verify queue backpressure handling

## Running Tests

### Individual Test Suites
```bash
# Queue operations
pnpm test:e2e --testNamePattern="notification-queue"

# Email notifications
pnpm test:e2e --testNamePattern="email-notifications"

# Push notifications  
pnpm test:e2e --testNamePattern="push-notifications"

# SMS notifications
pnpm test:e2e --testNamePattern="sms-notifications"

# Complete flows
pnpm test:e2e --testNamePattern="notification-flow"

# Bulk processing
pnpm test:e2e --testNamePattern="notification-bulk"
```

### All Notification Tests
```bash
pnpm test:e2e test/e2e/notifications/
```

## Test Environment

### Required Services
- PostgreSQL (TestContainer)
- Redis (TestContainer) 
- Mailpit (TestContainer)

### Environment Variables
```env
DATABASE_URL=postgresql://test_user:test_password@localhost:5432/test_db
REDIS_HOST=localhost
REDIS_PORT=6379
MAIL_HOST=localhost
MAIL_SMTP_PORT=1025
MAIL_HTTP_PORT=8025
TWILIO_ACCOUNT_SID=test_account_sid
TWILIO_AUTH_TOKEN=test_auth_token
```

### Mock Configuration
- FCM and APNS providers are mocked to prevent actual notifications
- Twilio SMS service is mocked with call tracking
- Email service uses real SMTP through Mailpit container

## Monitoring and Debugging

### Queue Monitoring
```typescript
// Check queue statistics
const stats = await notificationQueueService.getQueueStats();
console.log('Queue stats:', stats);

// Monitor job events
notificationQueue.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

notificationQueue.on('failed', (job, error) => {
  console.log(`Job ${job.id} failed:`, error.message);
});
```

### Email Debugging
```typescript
// Get all received emails
const messages = await MailpitHelper.getAllMessages();
console.log(`Received ${messages.length} emails`);

// Get specific email content
const email = messages[0];
const content = await MailpitHelper.getMessageContent(email.ID);
console.log('Email HTML:', content.HTML);
```

### Performance Metrics
```typescript
// Measure operation performance
const { result, duration } = await NotificationTestHelper.measurePerformance(
  () => processNotifications(100),
  'Bulk notification processing'
);
```

## Troubleshooting

### Common Issues

1. **Tests Hanging**
   - Check timeout values in Promise wrappers
   - Ensure proper cleanup of event listeners
   - Verify TestContainers are running

2. **Email Not Received**
   - Wait adequate time for SMTP delivery (2-3 seconds)
   - Check Mailpit container is accessible
   - Verify email configuration

3. **Queue Jobs Not Processing**
   - Ensure Redis container is running
   - Check BullMQ worker registration
   - Verify queue name consistency

4. **Mock Calls Not Tracked**
   - Confirm jest.spyOn setup before app.init()
   - Clear mock call arrays between tests
   - Verify provider injection

### Debugging Tips

- Use `console.log` for queue events and job status
- Check TestContainer logs for infrastructure issues  
- Verify environment variables are set correctly
- Use Jest's `--detectOpenHandles` for connection leaks
- Monitor queue statistics during test execution

## Future Enhancements

- Add WebSocket notification testing
- Implement notification template testing
- Add performance regression detection
- Create notification delivery analytics
- Add integration with external monitoring tools