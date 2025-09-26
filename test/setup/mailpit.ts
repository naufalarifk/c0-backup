import { equal, ok } from 'node:assert/strict';

import {
  assertDefined,
  assertPropArray,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
} from 'typeshaper';

export async function waitForEmail(mailpitApiUrl: string, receiver: string) {
  const maxRetries = 10;
  const retryDelay = 1000;
  attemptLoop: for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // console.debug(`Checking for email to ${receiver}, attempt ${attempt} of ${maxRetries}`);
    const response = await fetch(`${mailpitApiUrl}/api/v1/message/latest`);
    if (response.status === 404) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue attemptLoop;
    }
    if (response.status !== 200) {
      throw new Error(`Failed to fetch emails: ${response.statusText} ${await response.text()}`);
    }
    /**
     * @example responseObject {"ID":"83zicph5y7bRwtMostjVGV","MessageID":"2e5a344b-2be3-607e-4926-592f2be8e116@cryptogadai.com","From":{"Name":"CryptoGadai","Address":"no-reply@cryptogadai.com"},"To":[{"Name":"","Address":"grox@ymail.com"}],"Cc":[],"Bcc":[],"ReplyTo":[],"ReturnPath":"no-reply@cryptogadai.com","Subject":"Verify your email address","ListUnsubscribe":{"Header":"","Links":[],"Errors":"","HeaderPost":""},"Date":"2025-09-15T03:44:15Z","Tags":[],"Username":"","Text":"*********************\n✉️ Email Verification\n*********************\n\nHi grox@ymail.com! 👋\nThanks for signing up with CryptoGadai! We're excited to have you on board. To complete your registration and secure your account, please verify your email address by clicking the button below.\nVerify Email Address ( http://165.22.103.39:3100/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imdyb3hAeW1haWwuY29tIiwiaWF0IjoxNzU3OTA3ODU1LCJleHAiOjE3NTc5MTE0NTV9.yRNTNkpdl9jC5v5_3I04JuUkai8FD67zvD86uCE3RIg\u0026callbackURL=exp://192.168.0.104:8081/--/account-type?referrer=signup )\n\n*Button not working?* Copy and paste this link into your browser:\n\nhttp://165.22.103.39:3100/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imdyb3hAeW1haWwuY29tIiwiaWF0IjoxNzU3OTA3ODU1LCJleHAiOjE3NTc5MTE0NTV9.yRNTNkpdl9jC5v5_3I04JuUkai8FD67zvD86uCE3RIg\u0026callbackURL=exp://192.168.0.104:8081/--/account-type?referrer=signup\n\n*🔒 Security Note:* This verification link will expire in 24 hours for your security. If you didn't create an account with us, you can safely ignore this email.\n\nThis email was sent by CryptoGadai\nIf you have any questions, feel free to contact our support team.\n\n© 2025 CryptoGadai. All rights reserved.","HTML":"\u003c!DOCTYPE html\u003e\u003chtml lang=\"en\"\u003e\u003chead\u003e    \u003cmeta charset=\"UTF-8\"\u003e    \u003cmeta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"\u003e    \u003ctitle\u003eVerify Your Email Address\u003c/title\u003e    \u003cstyle\u003e        body {            margin: 0;            padding: 0;            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;            background-color: #f8fafc;            color: #334155;            line-height: 1.6;        }        .email-container {            max-width: 600px;            margin: 0 auto;            background-color: #ffffff;        }        .header {            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);            padding: 40px 30px;            text-align: center;        }        .header h1 {            color: #ffffff;            margin: 0;            font-size: 28px;            font-weight: 600;        }        .content {            padding: 40px 30px;        }        .greeting {            font-size: 18px;            margin-bottom: 20px;            color: #1e293b;        }        .message {            font-size: 16px;            margin-bottom: 30px;            color: #64748b;        }        .verification-button {            text-align: center;            margin: 30px 0;        }        .btn {            display: inline-block;            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);            color: #ffffff !important;            text-decoration: none;            padding: 16px 32px;            border-radius: 8px;            font-weight: 600;            font-size: 16px;            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);            transition: all 0.3s ease;        }        .btn:hover {            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);            transform: translateY(-1px);        }        .alternative-link {            margin-top: 30px;            padding: 20px;            background-color: #f1f5f9;            border-radius: 8px;            border-left: 4px solid #667eea;        }        .alternative-link p {            margin: 0 0 10px 0;            font-size: 14px;            color: #64748b;        }        .alternative-link code {            background-color: #e2e8f0;            padding: 2px 6px;            border-radius: 4px;            font-family: 'Courier New', monospace;            font-size: 12px;            word-break: break-all;            color: #1e293b;        }        .footer {            background-color: #f8fafc;            padding: 30px;            text-align: center;            border-top: 1px solid #e2e8f0;        }        .footer p {            margin: 0;            font-size: 14px;            color: #94a3b8;        }        .security-note {            margin-top: 30px;            padding: 15px;            background-color: #fef3c7;            border-radius: 6px;            border-left: 4px solid #f59e0b;        }        .security-note p {            margin: 0;            font-size: 14px;            color: #92400e;        }        @media only screen and (max-width: 600px) {            .email-container {                width: 100% !important;            }            .header, .content, .footer {                padding: 20px !important;            }            .header h1 {                font-size: 24px;            }            .btn {                padding: 14px 28px;                font-size: 15px;            }        }    \u003c/style\u003e\u003c/head\u003e\u003cbody\u003e    \u003cdiv class=\"email-container\"\u003e        \u003c!-- Header --\u003e        \u003cdiv class=\"header\"\u003e            \u003ch1\u003e✉️ Email Verification\u003c/h1\u003e        \u003c/div\u003e        \u003c!-- Content --\u003e        \u003cdiv class=\"content\"\u003e            \u003cdiv class=\"greeting\"\u003e                Hi grox@ymail.com! 👋            \u003c/div\u003e            \u003cdiv class=\"message\"\u003e                Thanks for signing up with CryptoGadai! We're excited to have you on board.                To complete your registration and secure your account, please verify your email address by clicking the button below.            \u003c/div\u003e            \u003cdiv class=\"verification-button\"\u003e                \u003ca href=\"http://165.22.103.39:3100/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imdyb3hAeW1haWwuY29tIiwiaWF0IjoxNzU3OTA3ODU1LCJleHAiOjE3NTc5MTE0NTV9.yRNTNkpdl9jC5v5_3I04JuUkai8FD67zvD86uCE3RIg\u0026callbackURL=exp://192.168.0.104:8081/--/account-type?referrer=signup\" class=\"btn\"\u003e                    Verify Email Address                \u003c/a\u003e            \u003c/div\u003e            \u003cdiv class=\"alternative-link\"\u003e                \u003cp\u003e\u003cstrong\u003eButton not working?\u003c/strong\u003e Copy and paste this link into your browser:\u003c/p\u003e                \u003ccode\u003e\u003ca href=\"http://165.22.103.39:3100/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imdyb3hAeW1haWwuY29tIiwiaWF0IjoxNzU3OTA3ODU1LCJleHAiOjE3NTc5MTE0NTV9.yRNTNkpdl9jC5v5_3I04JuUkai8FD67zvD86uCE3RIg\u0026callbackURL=exp://192.168.0.104:8081/--/account-type?referrer=signup\" target=\"_blank\" rel=\"noopener noreferrer\"\u003ehttp://165.22.103.39:3100/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imdyb3hAeW1haWwuY29tIiwiaWF0IjoxNzU3OTA3ODU1LCJleHAiOjE3NTc5MTE0NTV9.yRNTNkpdl9jC5v5_3I04JuUkai8FD67zvD86uCE3RIg\u0026callbackURL=exp://192.168.0.104:8081/--/account-type?referrer=signup\u003c/a\u003e\u003c/code\u003e            \u003c/div\u003e            \u003cdiv class=\"security-note\"\u003e                \u003cp\u003e                    \u003cstrong\u003e🔒 Security Note:\u003c/strong\u003e This verification link will expire in 24 hours for your security.                    If you didn't create an account with us, you can safely ignore this email.                \u003c/p\u003e            \u003c/div\u003e        \u003c/div\u003e        \u003c!-- Footer --\u003e        \u003cdiv class=\"footer\"\u003e            \u003cp\u003e                This email was sent by CryptoGadai\u003cbr\u003e                If you have any questions, feel free to contact our support team.            \u003c/p\u003e            \u003cp style=\"margin-top: 15px; font-size: 12px;\"\u003e                © 2025 CryptoGadai. All rights reserved.            \u003c/p\u003e        \u003c/div\u003e    \u003c/div\u003e\u003c/body\u003e\u003c/html\u003e","Size":7058,"Inline":[],"Attachments":[]}
     */
    const message = (await response.json()) as unknown;
    assertDefined(message);
    assertPropString(message, 'ID');
    assertPropString(message, 'MessageID');
    assertPropDefined(message, 'From');
    assertPropString(message.From, 'Name');
    assertPropString(message.From, 'Address');
    assertPropArrayMapOf(message, 'To', function (to) {
      assertDefined(to);
      assertPropString(to, 'Address');
      assertPropString(to, 'Name');
      return to;
    });
    assertPropArray(message, 'Cc');
    assertPropArray(message, 'Bcc');
    assertPropArray(message, 'ReplyTo');
    assertPropString(message, 'ReturnPath');
    assertPropString(message, 'Subject');
    assertPropDefined(message, 'ListUnsubscribe');
    assertPropString(message.ListUnsubscribe, 'Header');
    assertPropArray(message.ListUnsubscribe, 'Links');
    assertPropString(message.ListUnsubscribe, 'Errors');
    assertPropString(message.ListUnsubscribe, 'HeaderPost');
    assertPropString(message, 'Date');
    assertPropArray(message, 'Tags');
    assertPropString(message, 'Username');
    assertPropString(message, 'Text');
    assertPropString(message, 'HTML');
    assertPropNumber(message, 'Size');
    assertPropArray(message, 'Inline');
    assertPropArray(message, 'Attachments');
    for (const to of message.To) {
      if (to.Address.toLowerCase() === receiver.toLowerCase()) {
        // console.debug(`Email found for ${receiver} on attempt ${attempt}`);
        return message;
      }
    }
    if (attempt < maxRetries) {
      // console.debug(`Email not found for ${receiver}, retrying in ${retryDelay / 1000} seconds...`);
      await new Promise(res => setTimeout(res, retryDelay));
    } else {
      console.warn(`Max retries reached. Email to ${receiver} not found.`);
    }
  }
}

export async function waitForEmailVerification(mailpitApiUrl: string, receiver: string) {
  const emailMessage = await waitForEmail(mailpitApiUrl, receiver);
  /**
   * @example Hi Verify your email address!\r\n\r\nThanks for signing up with CryptoGadai! We're excited to have you on board.\r\nTo complete your registration and secure your account, please verify your email address by clicking the link below:\r\n\r\nhttps://172.22.0.4:3000/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InZhbGlkZW1haWxfbWZub3hxMG9AdGVzdC5jb20iLCJpYXQiOjE3NTgwOTU5NzAsImV4cCI6MTc1ODA5OTU3MH0.fV6frfV_qJOV3wUzlsAXIv9zPmY1ahwHQ-Qmy76oQaY&callbackURL=/account-type?referrer=signup\r\n\r\nSecurity Note: This verification link will expire in 24 hours for your security.\r\nIf you didn't create an account with us, you can safely ignore this email.\r\n\r\nThis email was sent by CryptoGadai\r\nIf you have any questions, feel free to contact our support team.\r\n\r\n© 2025 CryptoGadai. All rights reserved.'
   */
  const emailText = emailMessage?.Text ?? 'INVALID';
  const extractedVerificationLink =
    emailText.match(/https?:\/\/[^\s]+/g)?.[0] ??
    emailText.match(/http:\/\/[^\s]+/g)?.[0] ??
    'INVALID';

  ok(extractedVerificationLink !== 'INVALID', 'Failed to extract verification link from email');

  // eslint-disable-next-line no-undef
  const verificationResponse = await fetch(extractedVerificationLink, {
    redirect: 'manual',
  });
  equal(verificationResponse.status, 302);

  const emailVerificationRedirectLocation =
    verificationResponse.headers.get('location') ?? 'INVALID';
  // console.debug('Verification Redirect Location:', emailVerificationRedirectLocation);

  ok(
    emailVerificationRedirectLocation !== 'INVALID',
    'Failed to get redirect location after verification',
  );

  return {
    emailVerificationRedirectLocation,
  };
}

export async function waitForPasswordResetEmail(mailpitApiUrl: string, receiver: string) {
  const maxRetries = 10;
  const retryDelay = 1000; // we are interacting with local mailpit, it does not make sense to wait too long

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.debug(
      `Looking for password reset email to ${receiver}, attempt ${attempt} of ${maxRetries}`,
    );

    const response = await fetch(`${mailpitApiUrl}/api/v1/messages`);
    if (response.status !== 200) {
      throw new Error(`Failed to fetch emails: ${response.statusText}`);
    }

    const resp = (await response.json()) as unknown;

    assertDefined(resp);
    assertPropArrayMapOf(resp, 'messages', function (msg) {
      assertDefined(msg);
      assertPropString(msg, 'ID');
      assertPropString(msg, 'Created');
      assertPropArrayMapOf(msg, 'To', function (to) {
        assertDefined(to);
        assertPropString(to, 'Address');
        return to;
      });
      assertPropString(msg, 'Subject');
      return msg;
    });

    // Find the most recent password reset email for this receiver
    const passwordResetEmail = resp.messages
      .filter(
        msg =>
          msg.To?.some(to => to.Address.toLowerCase() === receiver.toLowerCase()) &&
          (msg.Subject?.includes('Reset') || msg.Subject?.includes('password')),
      )
      .sort((a, b) => {
        const dateA = a.Created ? new Date(a.Created).getTime() : 0;
        const dateB = b.Created ? new Date(b.Created).getTime() : 0;
        return dateB - dateA;
      })[0];

    if (passwordResetEmail) {
      console.debug(`Password reset email found for ${receiver} on attempt ${attempt}`);

      // Fetch the full email content using the message ID
      const fullEmailResponse = await fetch(
        `${mailpitApiUrl}/api/v1/message/${passwordResetEmail.ID}`,
      );
      if (fullEmailResponse.status !== 200) {
        throw new Error(`Failed to fetch full email: ${fullEmailResponse.statusText}`);
      }

      const fullEmail = await fullEmailResponse.json();
      const emailText = fullEmail.Text ?? 'INVALID';
      const emailHtml = fullEmail.HTML ?? 'INVALID';

      // Try to extract from both text and HTML
      const emailContent = emailText !== 'INVALID' ? emailText : emailHtml;

      // Extract the password reset link from the email
      const extractedResetLink =
        emailContent.match(/https?:\/\/[^\s<>"]+/g)?.[0] ??
        emailContent.match(/http:\/\/[^\s<>"]+/g)?.[0] ??
        'INVALID';
      console.info('Extracted Password Reset Link:', extractedResetLink);

      ok(extractedResetLink !== 'INVALID', 'Failed to extract password reset link from email');

      // For password reset, extract the token from the URL path
      // URL format: http://localhost:PORT/api/auth/reset-password/{token}?callbackURL=
      const url = new URL(extractedResetLink);
      const pathParts = url.pathname.split('/');
      const token = pathParts[pathParts.length - 1]; // Get the last part of the path

      ok(token && token.length > 0, 'Reset token not found in email URL');

      return {
        resetToken: token,
        resetLink: extractedResetLink,
      };
    }

    if (attempt < maxRetries) {
      console.debug(
        `Password reset email not found for ${receiver}, retrying in ${retryDelay / 1000} seconds...`,
      );
      await new Promise(res => setTimeout(res, retryDelay));
    }
  }

  throw new Error(`Password reset email not found for ${receiver} after ${maxRetries} attempts`);
}
