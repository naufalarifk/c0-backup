import type { Twilio } from 'twilio';
import type { MessageListInstanceCreateOptions } from 'twilio/lib/rest/api/v2010/account/message';

import { Injectable } from '@nestjs/common';
import invariant from 'tiny-invariant';
import twilio from 'twilio';

import { AppConfigService } from './app-config.service';

@Injectable()
export class TwilioService {
  private readonly client: Twilio;
  private readonly defaultFromSMS: string;
  private readonly defaultFromWhatsApp: string;

  constructor(private readonly configService: AppConfigService) {
    const { accountSid, authToken, phoneNumber } = this.configService.twilioConfig;
    this.defaultFromSMS = phoneNumber;
    this.client = twilio(accountSid, authToken);
  }

  // Send SMS
  async sendSMS(params: MessageListInstanceCreateOptions) {
    invariant(
      params.from || this.defaultFromSMS,
      'SMS from number must be provided either in params or as default',
    );

    return await this.client.messages.create({
      body: params.body,
      from: params.from || this.defaultFromSMS,
      to: params.to,
      mediaUrl: params.mediaUrl,
    });
  }

  // Send WhatsApp message
  async sendWhatsApp(options: MessageListInstanceCreateOptions) {
    const from = options.from || this.defaultFromWhatsApp;
    const to = options.to.startsWith('whatsapp:') ? options.to : `whatsapp:${options.to}`;

    return await this.client.messages.create({
      body: options.body,
      from,
      to,
      mediaUrl: options.mediaUrl,
    });
  }

  // Send voice call
  async makeCall(to: string, twimlUrl: string, from?: string) {
    invariant(from || this.defaultFromSMS, 'Voice call from number must be provided');

    return await this.client.calls.create({
      url: twimlUrl,
      to,
      from: from || this.defaultFromSMS,
    });
  }

  // Verify phone number (Twilio Verify)
  async sendVerificationCode(to: string, channel: 'sms' | 'call' = 'sms') {
    const verifyServiceSid = this.configService.twilioConfig.verifySid;

    return await this.client.verify.v2.services(verifyServiceSid).verifications.create({
      to,
      channel,
    });
  }

  // Check verification code
  async checkVerificationCode(to: string, code: string) {
    const verifyServiceSid = this.configService.twilioConfig.verifySid;

    return await this.client.verify.v2.services(verifyServiceSid).verificationChecks.create({
      to,
      code,
    });
  }

  // Get message status
  async getMessageStatus(messageSid: string) {
    return await this.client.messages(messageSid).fetch();
  }

  // Get call status
  async getCallStatus(callSid: string) {
    return await this.client.calls(callSid).fetch();
  }

  // List messages with filters
  async listMessages(options?: {
    from?: string;
    to?: string;
    dateSentAfter?: Date;
    dateSentBefore?: Date;
    limit?: number;
  }) {
    return await this.client.messages.list({
      from: options?.from,
      to: options?.to,
      dateSentAfter: options?.dateSentAfter,
      dateSentBefore: options?.dateSentBefore,
      limit: options?.limit || 50,
    });
  }

  // Getter methods
  getDefaultSMSFrom(): string {
    return this.defaultFromSMS;
  }

  getDefaultWhatsAppFrom(): string {
    return this.defaultFromWhatsApp;
  }

  // Expose client if needed for advanced usage
  getClient(): Twilio {
    return this.client;
  }
}
