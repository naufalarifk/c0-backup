import type { CreateEmailOptions, CreateEmailRequestOptions } from 'resend';

import { Injectable } from '@nestjs/common';
import { Resend } from 'resend';

import { AppConfigService } from './app-config.service';

type ResendEmailParams = Omit<CreateEmailOptions, 'from'> & {
  from?: string;
};

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private readonly defaultFrom: string;

  constructor(private readonly configService: AppConfigService) {
    const { apiKey, from } = this.configService.emailConfig;
    this.defaultFrom = `${this.configService.appConfig.appName} <${from}>`;
    this.resend = new Resend(apiKey);
  }

  async sendEmail(payload: ResendEmailParams, options?: CreateEmailRequestOptions) {
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
