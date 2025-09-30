# Notification Providers

## Available Providers

| Provider | Channel | Use Case | Status |
|----------|---------|----------|--------|
| **Expo** | Push | Mobile apps (Expo/React Native) | ✅ Active |
| **FCM** | Push | Android native, Web PWA | ✅ Active |
| **APNS** | Push | iOS native apps | ✅ Active |
| **Email** | Email | Transactional emails (Resend) | ✅ Active |
| **SMS** | SMS | Text messages (Twilio) | ✅ Active |

## Quick Setup

### 1. Environment Configuration

```bash
# Copy example environment
cp .env.example .env

# Configure providers in .env
EXPO_ACCESS_TOKEN=your-token-here
EXPO_ENABLED=true

FCM_PROJECT_ID=your-project-id
FCM_ENABLED=true

APNS_ENABLED=true

RESEND_API_KEY=your-api-key
EMAIL_ENABLED=true

TWILIO_ACCOUNT_SID=your-sid
TWILIO_AUTH_TOKEN=your-token
SMS_ENABLED=true
```

### 2. Get Provider Credentials

**Expo Token:**
```bash
npx expo login
npx expo token:create --scope push:send
```

**FCM:** Get from [Firebase Console](https://console.firebase.google.com) → Project Settings → Service Accounts

**APNS:** Configure in Apple Developer Portal

**Resend:** Get API key from [Resend Dashboard](https://resend.com/api-keys)

**Twilio:** Get credentials from [Twilio Console](https://console.twilio.com)

## Usage

### Send Push Notification (Expo)
```typescript
import { NotificationChannelEnum } from '../notification.types';

await notificationQueue.sendNotification({
  channel: NotificationChannelEnum.Expo,
  to: 'ExponentPushToken[xxxxxx]',
  title: 'Payment Received',
  body: 'You received 500 USDT',
  data: { paymentId: 'pay_123' },
  priority: 'high',
});
```

### Send Email
```typescript
await notificationQueue.sendNotification({
  channel: NotificationChannelEnum.Email,
  to: 'user@example.com',
  subject: 'Welcome to CryptoGadai',
  html: '<p>Your account has been created</p>',
  text: 'Your account has been created',
});
```

### Send SMS
```typescript
await notificationQueue.sendNotification({
  channel: NotificationChannelEnum.SMS,
  to: '+1234567890',
  body: 'Your verification code is 123456',
});
```

## Provider Architecture

### Auto-Discovery
Providers are automatically discovered using the `@NotificationProviderFlag` decorator:

```typescript
@Injectable()
@NotificationProviderFlag(NotificationChannelEnum.Expo)
export class ExpoNotificationProvider extends NotificationProvider {
  async send(payload: ExpoNotificationPayload): Promise<void> {
    // Implementation
  }
}
```

### Factory Pattern
`NotificationProviderFactory` automatically routes notifications to the correct provider based on the channel.

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid push token" | Wrong token format | Verify format: `ExponentPushToken[...]` |
| "Rate limit exceeded" | No access token (Expo) | Add access token for unlimited rate |
| "Failed to send" | Network/credentials | Check credentials and network connectivity |
| "Provider disabled" | Environment config | Set `[PROVIDER]_ENABLED=true` in .env |

## Monitoring

Check logs for provider status:
```bash
# Success
[INFO] Expo SDK initialized with access token
[INFO] Successfully sent notification

# Warnings
[WARN] Provider is disabled
[WARN] Using default priority (no token)

# Errors
[ERROR] Failed to send notification: {error}
[ERROR] Invalid token format
```

## Security Notes

- **Never commit** credentials to Git
- Use **environment variables** for all secrets
- **Rotate tokens** every 3-6 months
- Use **different credentials** for dev/staging/prod

## References

- [Expo Push Notifications](https://docs.expo.dev/push-notifications/overview/)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Apple Push Notifications](https://developer.apple.com/documentation/usernotifications)
- [Resend Documentation](https://resend.com/docs)
- [Twilio SMS](https://www.twilio.com/docs/sms)