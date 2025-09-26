import type {
  AnyNotificationPayload,
  EmailNotificationPayload,
  NotificationData,
} from '../notification.types';

import { Injectable } from '@nestjs/common';

import { assertDefined, assertPropNullableString, assertPropString } from 'typeshaper';

import { NotificationChannelEnum } from '../notification.types';
import { Composer, NotificationComposer } from '../notification-composer.abstract';

export type BeneficiaryVerificationNotificationData = NotificationData & {
  email: string;
  url: string;
  blockchain: string;
  address: string;
  label?: string;
};

function assertBeneficiaryVerificationNotificationData(
  data: unknown,
): asserts data is BeneficiaryVerificationNotificationData {
  assertDefined(data, 'Notification data is required');
  assertPropString(data, 'email', 'Email is required');
  assertPropString(data, 'url', 'Verification URL is required');
  assertPropString(data, 'blockchain', 'Blockchain is required');
  assertPropString(data, 'address', 'Wallet address is required');
  // label and name are optional, so only validate if present
  if (typeof data === 'object' && data !== null && 'label' in data) {
    assertPropNullableString(data, 'label');
  }
}

@Injectable()
@Composer('BeneficiaryVerification')
export class BeneficiaryVerificationNotificationComposer extends NotificationComposer<BeneficiaryVerificationNotificationData> {
  composePayloads(data: unknown): Promise<AnyNotificationPayload[]> {
    assertBeneficiaryVerificationNotificationData(data);

    const payloadEmail: EmailNotificationPayload = {
      channel: NotificationChannelEnum.Email,
      to: data.email,
      subject: 'Please verify your withdrawal address',
      htmlBody: this.renderEmailHtmlBody(data),
      textBody: this.renderEmailTextBody(data),
    };

    return Promise.resolve([payloadEmail]);
  }

  private renderEmailHtmlBody(data: BeneficiaryVerificationNotificationData): string {
    const styles = this.getEmailStyles();

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Verify Your Withdrawal Address</title>
    <style>${styles}</style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <h1>🔒 Address Verification</h1>
        </div>

        <!-- Content -->
        <div class="content">
            <div class="greeting">
                Hi ${data.name || 'there'}! 👋
            </div>

            <div class="message">
                You've added a new withdrawal address to your CryptoGadai account.
                For your security, please verify this address before it can be used for withdrawals.
            </div>

            <div class="address-details">
                ${data.label ? `<p><strong>Address Label:</strong> ${data.label}</p>` : ''}
                <p><strong>Blockchain:</strong> ${data.blockchain}</p>
                <p><strong>Address:</strong> <code class="address">${data.address}</code></p>
            </div>

            <div class="verification-button">
                <a href="${data.url}" class="btn">
                    Verify Withdrawal Address
                </a>
            </div>

            <div class="alternative-link">
                <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
                <code><a href="${data.url}" target="_blank" rel="noopener noreferrer">${data.url}</a></code>
            </div>

            <div class="security-note">
                <p>
                    <strong>🔒 Security Note:</strong> This verification link will expire in 24 hours for your security.
                    If you didn't add this address, please contact our support team immediately.
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

        .address-details {
            background-color: #f8fafc;
            padding: 20px;
            border-radius: 8px;
            border-left: 4px solid #3b82f6;
            margin: 20px 0;
        }

        .address-details p {
            margin: 8px 0;
            font-size: 14px;
            color: #1e293b;
        }

        .address {
            background-color: #e2e8f0;
            padding: 4px 8px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            font-size: 12px;
            word-break: break-all;
            color: #1e293b;
        }

        .verification-button {
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

            .address-details {
                padding: 15px;
            }
        }
    `;
  }

  private renderEmailTextBody(data: BeneficiaryVerificationNotificationData): string {
    return `
Hi ${data.name || 'there'}!

You've added a new withdrawal address to your CryptoGadai account.
For your security, please verify this address before it can be used for withdrawals.

Address Details:${
      data.label
        ? `
- Label: ${data.label}`
        : ''
    }
- Blockchain: ${data.blockchain}
- Address: ${data.address}

To verify this address, please click the link below:
${data.url}

Security Note: This verification link will expire in 24 hours for your security.
If you didn't add this address, please contact our support team immediately.

This email was sent by CryptoGadai
If you have any questions, feel free to contact our support team.

© ${new Date().getFullYear()} CryptoGadai. All rights reserved.
  `.trim();
  }
}
