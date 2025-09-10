const NotificationChannelEnum = {
  InApp: 'InApp' as const,
  Email: 'Email' as const,
  SMS: 'SMS' as const,
  FCM: 'FCM' as const,
  APN: 'APN' as const,
};

export type NotificationPayload = {
  channel: typeof NotificationChannelEnum[keyof typeof NotificationChannelEnum];
};

export type PushNotificationPayload = NotificationPayload & {
  channel: typeof NotificationChannelEnum.FCM | typeof NotificationChannelEnum.APN;
  to: string;
  title: string;
  body: string;
}

export type FCMNotificationPayload = PushNotificationPayload & {
  channel: typeof NotificationChannelEnum.FCM;
  data?: Record<string, string>;
  icon?: string;
  clickAction?: string;
  sound?: string;
  badge?: string;
}

export type APNSNotificationPayload = PushNotificationPayload & {
  channel: typeof NotificationChannelEnum.APN;
  sound?: string;
  badge?: number;
  category?: string;
}

export type InAppNotificationPayload = NotificationPayload & {
  channel: typeof NotificationChannelEnum.InApp;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
}

export type EmailNotificationPayload = NotificationPayload & {
  channel: typeof NotificationChannelEnum.Email;
  to: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}

export type SMSNotificationPayload = NotificationPayload & {
  channel: typeof NotificationChannelEnum.SMS;
  message: string;
}

/**
 * there will be many NotificationCoposers, each for specific event
 * e.g. NewMessageNotificationComposer, FriendRequestNotificationComposer, etc.
 */
export abstract class NotificationComposer {
  abstract composePayloads(): Promise<NotificationPayload[]>;
}

export abstract class NotificationProvider {
  abstract isSendablePayload(payload: NotificationPayload): boolean;
  abstract send(notification: NotificationPayload): Promise<void>;
}

// === EXAMPLE USAGE ===

class NewMessageNotification extends NotificationComposer {
  constructor(
    private params: any, // Hipotetical data from application
  ) {
    super();
  }

  async composePayloads(): Promise<NotificationPayload[]> {
    return [
      {
        channel: 'InApp',
        userId: this.params.userId,
        type: 'NEW_MESSAGE',
        title: 'New Message Received',
        body: `You have a new message from ${this.params.senderName}.`,
        link: `/messages/${this.params.messageId}`,
      } as InAppNotificationPayload,
      {
        channel: 'Email',
        to: this.params.email,
        subject: 'New Message Received',
        htmlBody: `<p>You have a new message from ${this.params.senderName}.</p><p>${this.params.messageSnippet}</p>`,
        textBody: `You have a new message from ${this.params.senderName}.\n\n${this.params.messageSnippet}`,
      } as EmailNotificationPayload,
    ];
  }
}

class EmailNotificationProvider extends NotificationProvider {
  isSendablePayload(payload: NotificationPayload): boolean {
    throw new Error('Not implemented');
  }
  async send(notification: EmailNotificationPayload): Promise<void> {
    // Hypothetical email sending logic
    console.log(`Sending email to ${notification.to} with subject "${notification.subject}"`);
  }
}

// hipotetical import statements for NestJS and BullMQ
const { Processor, WorkerHost } = undefined as any; // import from '@nestjs/bullmq'
type Job<TData = unknown, TResult = unknown, TName extends string = string> = any; // import from 'bullmq'

@Processor('notificationQueue')
class NotificationProcessor extends WorkerHost {
  /**
   * The job of the task is
   * - receive event from the queue
   * - route the event to the proper NotificationComposer
   * - execute the composer to get the payloads
   * - route each payload to the proper NotificationProvider
   * - execute the provider to send the notification
   */
  async process(job: Job<unknown, unknown, string>): Promise<void> {
    const composer = await this.routeJobToComposer(job);
    const payloads = await composer.composePayloads();
    for (const [index, payload] of payloads.entries()) {
      const provider = await this.findProviderByPayload(payload);
      await provider.send(payload);
      await job.updateProgress(100 * (index + 1) / payloads.length);
    }
  }

  async routeJobToComposer(job: Job): Promise<NotificationComposer> {
    throw new Error('Not implemented');
  }

  async findProviderByPayload(payload: NotificationPayload): Promise<NotificationProvider> {
    throw new Error('Not implemented');
  }
} 
