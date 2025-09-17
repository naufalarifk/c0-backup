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
  deepLink: string;
  name?: string;
};

function assertEmailPasswordResetNotificationData(
  data: unknown,
): asserts data is EmailPasswordResetNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'email', 'Email is required');
  assertPropString(data, 'url', 'URL is required');
  assertPropString(data, 'deepLink', 'Deep link is required');
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

        .reset-button {
            text-align: center;
            margin: 30px 0;
        }

        .btn {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #ffffff !important;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 16px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
        }

        .btn-secondary {
            background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%);
            display: inline-block;
            color: #ffffff !important;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 15px;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            transition: all 0.3s ease;
            margin: 0 10px;
        }

        .btn-secondary:hover {
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            transform: translateY(-1px);
        }

        .app-buttons {
            text-align: center;
            margin: 30px 0;
            padding: 25px;
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-radius: 12px;
            border: 1px solid #bae6fd;
        }

        .app-buttons-title {
            font-size: 16px;
            font-weight: 600;
            color: #0369a1;
            margin-bottom: 15px;
        }

        .app-icon {
            width: 20px;
            height: 20px;
            display: inline-block;
            margin-right: 8px;
            vertical-align: middle;
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
            border-left: 4px solid #667eea;
        }

        .alternative-link p {
            margin: 0 0 10px 0;
            font-size: 14px;
            color: #64748b;
        }

        .alternative-link code {
            background-color: #e2e8f0;
            padding: 8px 12px;
            border-radius: 6px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            word-break: break-all;
            color: #1e293b;
            display: block;
            margin-top: 10px;
        }

        .info-box {
            margin-top: 25px;
            padding: 15px;
            background-color: #eff6ff;
            border-radius: 6px;
            border-left: 4px solid #3b82f6;
        }

        .info-box p {
            margin: 0;
            font-size: 14px;
            color: #1e40af;
        }

        .info-box ul {
            margin: 10px 0 0 20px;
            padding: 0;
            color: #1e40af;
        }

        .info-box li {
            margin: 5px 0;
            font-size: 14px;
        }

        .divider {
            text-align: center;
            margin: 20px 0;
            font-size: 14px;
            color: #94a3b8;
            position: relative;
        }

        .divider::before,
        .divider::after {
            content: '';
            position: absolute;
            top: 50%;
            width: 40%;
            height: 1px;
            background-color: #e2e8f0;
        }

        .divider::before {
            left: 0;
        }

        .divider::after {
            right: 0;
        }

        .platform-note {
            margin-top: 20px;
            padding: 12px;
            background-color: #f0fdf4;
            border-radius: 6px;
            border-left: 4px solid #22c55e;
            font-size: 13px;
            color: #14532d;
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

            .btn, .btn-secondary {
                padding: 14px 28px;
                font-size: 15px;
                display: block;
                margin: 10px 0;
            }

            .app-buttons {
                padding: 20px 15px;
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
                We received a request to reset the password for your CryptoGadai account.
                If you made this request, choose how you'd like to reset your password below.
                If you didn't request a password reset, you can safely ignore this email.
            </div>

            <!-- Primary Reset Button for Web -->
            <div class="reset-button">
                <a href="${data.url}" class="btn">
                    🌐 Reset Password on Web
                </a>
            </div>

            <div class="divider">OR</div>

            <!-- App Deep Link Buttons -->
            <div class="app-buttons">
                <div class="app-buttons-title">
                    📱 Reset directly in the mobile app
                </div>
                <div style="margin-top: 15px;">
                    <a href="${data.deepLink}" class="btn-secondary">
                        <span class="app-icon">📲</span>
                        Open in CryptoGadai App
                    </a>
                </div>
                <div class="platform-note">
                    <strong>Note:</strong> The mobile app link will only work if you have the CryptoGadai app installed on your device.
                </div>
            </div>

            <!-- Alternative Links Section -->
            <div class="alternative-link">
                <p><strong>Having trouble with the buttons?</strong> Copy and paste one of these links into your browser:</p>

                <p style="margin-top: 15px; font-weight: 600; color: #475569;">For Web Browser:</p>
                <code><a href="${data.url}">${data.url}</a></code>

                <p style="margin-top: 15px; font-weight: 600; color: #475569;">For Mobile App:</p>
                <code><a href="${data.deepLink}">${data.deepLink}</a></code>
            </div>

            <div class="info-box">
                <p><strong>📝 Password Tips:</strong></p>
                <ul>
                    <li>Use at least 8 characters</li>
                    <li>Include a mix of uppercase and lowercase letters</li>
                    <li>Add numbers and special characters</li>
                    <li>Avoid using common words or personal information</li>
                </ul>
            </div>

            <div class="security-note">
                <p>
                    <strong>⏰ Important:</strong> This password reset link will expire in 1 Hour for your security.
                    After that, you'll need to request a new password reset link.
                </p>
            </div>

            <div class="security-note" style="background-color: #fee2e2; border-left-color: #ef4444; margin-top: 15px;">
                <p style="color: #991b1b;">
                    <strong>🚨 Security Alert:</strong> If you didn't request this password reset,
                    someone might be trying to access your account. Please secure your account immediately
                    and contact our support team.
                </p>
            </div>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p>
                This email was sent by CryptoGadai<br>
                If you have any questions or concerns, please contact our support team immediately.
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

We received a request to reset the password for your CryptoGadai account.
If you made this request, choose how you'd like to reset your password below.
If you didn't request a password reset, you can safely ignore this email.

To reset your password, choose your preferred option:

🌐 Reset on Web: ${data.url}
📱 Reset in App: ${data.deepLink}

Password Tips:
- Use at least 8 characters
- Include a mix of uppercase and lowercase letters
- Add numbers and special characters
- Avoid using common words or personal information

Important: This password reset link will expire in 1 Hour for your security.
After that, you'll need to request a new password reset link.

Security Alert: If you didn't request this password reset,
someone might be trying to access your account. Please secure your account immediately
and contact our support team.

This email was sent by CryptoGadai
If you have any questions, feel free to contact our support team.

© ${new Date().getFullYear()} CryptoGadai. All rights reserved.
  `.trim();
  }
}
