import { Injectable } from '@nestjs/common';

import nodemailer from 'nodemailer';

import { AppConfigService } from './app-config.service';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;
  private readonly defaultFrom: string;

  constructor(private readonly configService: AppConfigService) {
    const { host, port, user, pass, secure, ignoreTLS, requireTLS, from } =
      this.configService.emailConfig;
    this.defaultFrom = `${this.configService.appConfig.appName} <${from}>`;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      ...(user && pass ? { auth: { user, pass } } : {}),
      secure,
      ignoreTLS,
      requireTLS,
    });
  }

  async sendMail(params: Parameters<typeof this.transporter.sendMail>[0]) {
    const emailParams = {
      ...params,
      from: params.from || this.defaultFrom,
    };
    return await this.transporter.sendMail(emailParams);
  }

  getClient() {
    return this.transporter;
  }
}
