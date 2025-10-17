import type { Transporter } from 'nodemailer';
import type { CreateEmailOptions, CreateEmailRequestOptions } from 'resend';

import { Injectable } from '@nestjs/common';

import * as nodemailer from 'nodemailer';
import { Resend } from 'resend';

import { AppConfigService } from './app-config.service';

type ResendEmailParams = Omit<CreateEmailOptions, 'from'> & {
  from?: string;
};

@Injectable()
export class EmailService {
  private readonly resend: Resend;
  private smtpTransporter: Transporter | null = null;
  private readonly defaultFrom: string;
  private readonly useSmtp: boolean;

  constructor(private readonly configService: AppConfigService) {
    const { apiKey, from, host, port, user, pass, secure, ignoreTLS } =
      this.configService.emailConfig;
    this.defaultFrom = `${this.configService.app.name} <${from}>`;

    // Use SMTP in test environment
    this.useSmtp = this.configService.emailConfig.useSmtp;

    if (this.useSmtp) {
      this.smtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: user && pass ? { user, pass } : undefined,
        tls: {
          rejectUnauthorized: !ignoreTLS,
        },
      });
    } else {
      this.resend = new Resend(apiKey);
    }
  }

  async sendEmail(payload: ResendEmailParams, options?: CreateEmailRequestOptions) {
    if (this.useSmtp && this.smtpTransporter) {
      // Use SMTP for test environment
      const mailOptions = {
        from: payload.from || this.defaultFrom,
        to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
        cc: payload.cc
          ? Array.isArray(payload.cc)
            ? payload.cc.join(', ')
            : payload.cc
          : undefined,
        bcc: payload.bcc
          ? Array.isArray(payload.bcc)
            ? payload.bcc.join(', ')
            : payload.bcc
          : undefined,
        replyTo: payload.replyTo,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
      };

      const info = await this.smtpTransporter.sendMail(mailOptions);
      return { data: { id: info.messageId }, error: null };
    } else {
      // Use Resend for production
      const emailParams = {
        ...(payload as CreateEmailOptions),
        from: payload.from || this.defaultFrom,
      };
      const res = await this.resend.emails.send(emailParams, options);
      return res;
    }
  }

  getClient() {
    return this.resend;
  }
}
