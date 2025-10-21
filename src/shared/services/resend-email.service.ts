import type { CreateEmailOptions, CreateEmailRequestOptions } from 'resend';

import { Injectable } from '@nestjs/common';

import { Resend } from 'resend';

import { AppConfigService } from './app-config.service';
import { type EmailPayload, EmailService } from './email.abstract';

@Injectable()
export class ResendEmailService extends EmailService {
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor(private readonly configService: AppConfigService) {
    super();
    const { apiKey, from } = this.configService.emailConfig;
    this.defaultFrom = `${this.configService.app.name} <${from}>`;
    this.resend = new Resend(apiKey);
  }

  async sendEmail(payload: EmailPayload, options?: CreateEmailRequestOptions) {
    const emailParams = {
      ...(payload as CreateEmailOptions),
      from: payload.from || this.defaultFrom,
    };
    const res = await this.resend.emails.send(emailParams, options);
    return res;
  }

  getClient() {
    return this.resend;
  }
}
