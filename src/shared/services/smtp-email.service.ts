import type { Transporter } from 'nodemailer';
import type { CreateEmailRequestOptions } from 'resend';

import { Injectable } from '@nestjs/common';

import * as nodemailer from 'nodemailer';

import { AppConfigService } from './app-config.service';
import { type EmailPayload, EmailService } from './email.abstract';

@Injectable()
export class SmtpEmailService extends EmailService {
  private readonly smtpTransporter: Transporter;
  private readonly defaultFrom: string;

  constructor(private readonly configService: AppConfigService) {
    super();
    const { from, host, port, user, pass, secure, ignoreTLS } = this.configService.emailConfig;
    this.defaultFrom = `${this.configService.app.name} <${from}>`;

    this.smtpTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: !ignoreTLS,
      },
    });
  }

  async sendEmail(payload: EmailPayload, options?: CreateEmailRequestOptions) {
    const mailOptions = {
      from: payload.from || this.defaultFrom,
      to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
      cc: payload.cc ? (Array.isArray(payload.cc) ? payload.cc.join(', ') : payload.cc) : undefined,
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
    return { data: { id: info.messageId || '' }, error: null };
  }

  getClient() {
    return this.smtpTransporter;
  }
}
