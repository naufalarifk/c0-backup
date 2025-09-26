import type {
  AnyNotificationPayload,
  EmailNotificationPayload,
  NotificationData,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertProp, assertPropString, check, isNumber, isString } from 'typeshaper';

import { AppConfigService } from '../../../shared/services/app-config.service';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type UserRegisteredNotificationData = NotificationData & {
  type: 'UserRegistered';
  userId: string | number;
  email: string;
  name?: string;
};

export function assertUserRegisteredNotificationParam(
  data: unknown,
): asserts data is UserRegisteredNotificationData {
  assertDefined(data, 'Notification data is required');
  assertProp(v => v === ('UserRegistered' as const), data, 'type');
  assertProp(check(isString, isNumber), data, 'userId');
  assertPropString(data, 'email');
}

@Injectable()
@Composer('UserRegistered')
export class UserRegisteredNotificationComposer extends NotificationComposer<UserRegisteredNotificationData> {
  constructor(private appConfig: AppConfigService) {
    super();
  }

  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertUserRegisteredNotificationParam(data);
    const userName = data.name || data.email || String(data.userId);
    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.Email,
        to: data.email,
        subject: 'Welcome to CryptoGadai - Account Created Successfully',
        htmlBody: this.renderEmailHtmlBody(userName),
        textBody: this.renderEmailTextBody(userName),
      } as EmailNotificationPayload,
    ]);
  }

  private renderEmailHtmlBody(userName: string): string {
    const styles = this.getEmailStyles();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to CryptoGadai</title>
    <style>${styles}</style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <h1>🎉 Welcome to CryptoGadai</h1>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                Hi ${userName}! 👋
            </div>

            <div class="message">
                Thank you for creating an account with us. Your registration was successful!
                We're excited to have you on board.
            </div>

            <div class="features">
                <h3>You can now:</h3>
                <div class="feature-list">
                    <div class="feature-item">
                        <span class="feature-icon">📊</span>
                        <span class="feature-text">Access your personal dashboard</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">✅</span>
                        <span class="feature-text">Complete your KYC verification</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">🚀</span>
                        <span class="feature-text">Start using our services</span>
                    </div>
                </div>
            </div>

            <div class="action-buttons">
                <div class="button-group">
                    <a href="${this.appConfig.appConfig.scheme}dashboard" class="btn btn-app">
                        📱 Open in App
                    </a>
                    <a href="/dashboard" class="btn btn-web">
                        🌐 Open in Browser
                    </a>
                </div>
            </div>

            <div class="alternative-links">
                <p><strong>Links not working?</strong> Copy and paste these links:</p>
                <div class="link-options">
                    <div class="link-option">
                        <strong>App:</strong> <code><a href="${this.appConfig.appConfig.scheme}dashboard" target="_blank" rel="noopener noreferrer">${this.appConfig.appConfig.scheme}dashboard</a></code>
                    </div>
                    <div class="link-option">
                        <strong>Web:</strong> <code><a href="/dashboard" target="_blank" rel="noopener noreferrer">/dashboard</a></code>
                    </div>
                </div>
            </div>

            <div class="security-note">
                <p>
                    <strong>🔒 Security Note:</strong> If you didn't create this account,
                    please contact our support team immediately.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>
                This email was sent by CryptoGadai<br>
                If you have any questions, feel free to contact our support team.
            </p>
            <p style="margin-top: 15px; font-size: 12px;">
                © ${new Date().getFullYear()} CryptoGadai. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;
  }

  private getEmailStyles(): string {
    return `
        body {
            margin: 0;
            padding: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background-color: #f8fafc;
            color: #334155;
            line-height: 1.6;
        }

        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 40px 30px;
            text-align: center;
        }

        .header h1 {
            color: #ffffff;
            margin: 0;
            font-size: 28px;
            font-weight: 600;
        }

        .content {
            padding: 40px 30px;
        }

        .greeting {
            font-size: 18px;
            margin-bottom: 20px;
            color: #1e293b;
        }

        .message {
            font-size: 16px;
            margin-bottom: 30px;
            color: #64748b;
        }

        .features {
            margin: 30px 0;
        }

        .features h3 {
            font-size: 18px;
            color: #1e293b;
            margin-bottom: 15px;
        }

        .feature-list {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
        }

        .feature-item {
            display: flex;
            align-items: center;
            margin: 12px 0;
            font-size: 14px;
            color: #1e293b;
        }

        .feature-icon {
            font-size: 16px;
            margin-right: 10px;
            width: 20px;
            text-align: center;
        }

        .feature-text {
            flex: 1;
        }

        .action-buttons {
            text-align: center;
            margin: 30px 0;
        }

        .button-group {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
        }

        .btn {
            display: inline-block;
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 24px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            min-width: 140px;
            text-align: center;
        }

        .btn-app {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        }

        .btn-web {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }

        .btn:hover {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
        }

        .alternative-links {
            margin-top: 30px;
            padding: 20px;
            background-color: #f1f5f9;
            border-radius: 8px;
            border-left: 4px solid #667eea;
        }

        .alternative-links p {
            margin: 0 0 15px 0;
            font-size: 14px;
            color: #64748b;
        }

        .link-options {
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .link-option {
            font-size: 13px;
            color: #1e293b;
        }

        .link-option strong {
            display: inline-block;
            width: 50px;
            color: #64748b;
        }

        .link-option code {
            background-color: #e2e8f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 11px;
            word-break: break-all;
            color: #1e293b;
        }

        .security-note {
            margin-top: 30px;
            padding: 15px;
            background-color: #fef3c7;
            border-radius: 6px;
            border-left: 4px solid #f59e0b;
        }

        .security-note p {
            margin: 0;
            font-size: 14px;
            color: #92400e;
        }

        .footer {
            background-color: #f8fafc;
            padding: 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
        }

        .footer p {
            margin: 0;
            font-size: 14px;
            color: #94a3b8;
        }

        /* Responsive */
        @media only screen and (max-width: 600px) {
            .email-container {
                width: 100% !important;
            }

            .header, .content, .footer {
                padding: 20px !important;
            }

            .header h1 {
                font-size: 24px;
            }

            .button-group {
                flex-direction: column;
                align-items: center;
            }

            .btn {
                padding: 14px 20px;
                font-size: 14px;
                min-width: 160px;
            }

            .feature-list {
                padding: 15px;
            }

            .link-options {
                gap: 15px;
            }

            .link-option strong {
                display: block;
                margin-bottom: 5px;
                width: auto;
            }
        }
    `;
  }

  private renderEmailTextBody(userName: string): string {
    return `
Hi ${userName}! 👋

Thank you for creating an account with us. Your registration was successful!
We're excited to have you on board.

You can now:
- Access your personal dashboard
- Complete your KYC verification
- Start using our services

To access your dashboard, choose your preferred option:

📱 Open in App: ${this.appConfig.appConfig.scheme}dashboard
🌐 Open in Browser: /dashboard

Security Note: If you didn't create this account, please contact our support team immediately.

This email was sent by CryptoGadai
If you have any questions, feel free to contact our support team.

© ${new Date().getFullYear()} CryptoGadai. All rights reserved.
    `.trim();
  }
}
