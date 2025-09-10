import type {
  AnyNotificationPayload,
  EmailNotificationPayload,
  NotificationData,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from '../../../shared/utils';
import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type EmailPasswordResetNotificationData = NotificationData & {
  email: string;
  url: string;
  name?: string;
};

function assertEmailPasswordResetNotificationData(
  data: unknown,
): asserts data is EmailPasswordResetNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'email', 'Email is required');
  assertPropString(data, 'url', 'URL is required');
  // name is optional, so only validate if present
  if (typeof data === 'object' && data !== null && 'name' in data) {
    assertPropNullableString(data, 'name');
  }
}

@Injectable()
@Composer('PasswordResetRequested')
export class PasswordResetNotificationComposer extends NotificationComposer<EmailPasswordResetNotificationData> {
  async composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertEmailPasswordResetNotificationData(data);
    return await Promise.resolve([
      {
        channel: NotificationChannelEnum.Email,
        to: data.email,
        subject: 'Reset your password',
        htmlBody: this.renderEmailHtmlBody(data),
        textBody: this.renderEmailTextBody(data),
      } as EmailNotificationPayload,
    ]);
  }

  private renderEmailHtmlBody(data: EmailPasswordResetNotificationData): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Your Password</title>
    <style>
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
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
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

        .reset-button {
            text-align: center;
            margin: 30px 0;
        }

        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }

        .btn:hover {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
        }

        .alternative-link {
            margin-top: 30px;
            padding: 20px;
            background-color: #f1f5f9;
            border-radius: 8px;
            border-left: 4px solid #dc2626;
        }

        .alternative-link p {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #64748b;
        }

        .alternative-link code {
            background-color: #e2e8f0;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            word-break: break-all;
            color: #1e293b;
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

            .btn {
                padding: 14px 28px;
                font-size: 15px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <h1>🔒 Password Reset</h1>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                Hi ${data.name || 'there'}! 👋
            </div>

            <div class="message">
                We received a request to reset your password for your CryptoGadai account.
                If you made this request, click the button below to reset your password.
            </div>

            <div class="reset-button">
                <a href="${data.url}" class="btn">
                    Reset Password
                </a>
            </div>

            <div class="alternative-link">
                <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
                <code>${data.url}</code>
            </div>

            <div class="security-note">
                <p>
                    <strong>🔒 Security Note:</strong> This password reset link will expire in 15 minutes for your security.
                    If you didn't request a password reset, you can safely ignore this email - your account remains secure.
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

  private renderEmailTextBody(data: EmailPasswordResetNotificationData): string {
    return `
Hi ${data.name || 'there'}!

We received a request to reset your password for your CryptoGadai account.
If you made this request, click the link below to reset your password:

${data.url}

Security Note: This password reset link will expire in 15 minutes for your security.
If you didn't request a password reset, you can safely ignore this email - your account remains secure.

This email was sent by CryptoGadai
If you have any questions, feel free to contact our support team.

© ${new Date().getFullYear()} CryptoGadai. All rights reserved.
  `.trim();
  }
}
