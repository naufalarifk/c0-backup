import fs from 'node:fs/promises';

import { Injectable } from '@nestjs/common';

import Handlebars from 'handlebars';
import nodemailer from 'nodemailer';

import { AppConfigService } from './app-config.service';

@Injectable()
export class MailerService {
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: AppConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.emailConfig.host,
      port: this.configService.emailConfig.port,
      auth: {
        user: this.configService.emailConfig.user,
        pass: this.configService.emailConfig.pass,
      },
      secure: this.configService.emailConfig.secure,
      ignoreTLS: this.configService.emailConfig.ignoreTLS,
      requireTLS: this.configService.emailConfig.requireTLS,
    });
  }

  async sendMail({
    templatePath,
    context,
    ...mailOptions
  }: nodemailer.SendMailOptions & {
    templatePath: string;
    context: Record<string, unknown>;
  }) {
    let html: string | undefined;
    if (templatePath) {
      const template = await fs.readFile(templatePath, 'utf-8');
      html = Handlebars.compile(template, {
        strict: true,
      })(context);
    }

    await this.transporter.sendMail({
      ...mailOptions,
      from: mailOptions.from
        ? mailOptions.from
        : `"${this.configService.emailConfig.defaultName}" <${this.configService.emailConfig.defaultEmail}>`,
      html: mailOptions.html ? mailOptions.html : html,
    });
  }
}
