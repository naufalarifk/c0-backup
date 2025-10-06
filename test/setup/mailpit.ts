import { equal, ok } from 'node:assert/strict';

import {
  assertDefined,
  assertPropArray,
  assertPropArrayMapOf,
  assertPropDefined,
  assertPropNumber,
  assertPropString,
} from 'typeshaper';

type MailpitRecipient = {
  Address?: string;
  Name?: string;
};

type MailpitMessageSummary = {
  ID: string;
  Created?: string;
  To?: MailpitRecipient[];
};

type MailpitMessageListResponse = {
  messages: MailpitMessageSummary[];
};

type MailpitListUnsubscribe = {
  Header: string;
  Links: unknown[];
  Errors: string;
  HeaderPost: string;
};

type MailpitMessage = MailpitMessageSummary & {
  MessageID: string;
  From: MailpitRecipient;
  Cc: unknown[];
  Bcc: unknown[];
  ReplyTo: unknown[];
  ReturnPath: string;
  Subject: string;
  ListUnsubscribe: MailpitListUnsubscribe;
  Date: string;
  Tags: unknown[];
  Username: string;
  Text: string;
  HTML: string;
  Size: number;
  Inline: unknown[];
  Attachments: unknown[];
};

function parseMailpitListResponse(value: unknown): MailpitMessageListResponse | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const rawMessages = record.messages;
  if (!Array.isArray(rawMessages)) {
    return undefined;
  }

  for (const item of rawMessages) {
    if (!item || typeof item !== 'object') {
      return undefined;
    }

    const messageRecord = item as Record<string, unknown>;
    if (typeof messageRecord.ID !== 'string') {
      return undefined;
    }

    const created = messageRecord.Created;
    if (created !== undefined && typeof created !== 'string') {
      return undefined;
    }

    const rawRecipients = messageRecord.To;
    if (rawRecipients !== undefined) {
      if (!Array.isArray(rawRecipients)) {
        return undefined;
      }

      for (const recipient of rawRecipients) {
        if (!recipient || typeof recipient !== 'object') {
          return undefined;
        }

        const recipientRecord = recipient as Record<string, unknown>;
        const address = recipientRecord.Address;
        if (address !== undefined && typeof address !== 'string') {
          return undefined;
        }

        const name = recipientRecord.Name;
        if (name !== undefined && typeof name !== 'string') {
          return undefined;
        }
      }
    }
  }

  return { messages: rawMessages as MailpitMessageSummary[] };
}

function validateMailpitMessage(value: unknown): MailpitMessage | undefined {
  try {
    assertDefined(value);
    assertPropString(value, 'ID');
    assertPropString(value, 'MessageID');
    assertPropDefined(value, 'From');

    const message = value as MailpitMessage;

    assertDefined(message.From);
    assertPropString(message.From, 'Name');
    assertPropString(message.From, 'Address');
    assertPropArrayMapOf(message, 'To', function (to) {
      assertDefined(to);
      assertPropString(to, 'Address');
      if (Object.hasOwn(to, 'Name')) {
        assertPropString(to, 'Name');
      }
      return to;
    });
    assertPropArray(message, 'Cc');
    assertPropArray(message, 'Bcc');
    assertPropArray(message, 'ReplyTo');
    assertPropString(message, 'ReturnPath');
    assertPropString(message, 'Subject');
    assertPropDefined(message, 'ListUnsubscribe');
    assertDefined(message.ListUnsubscribe);
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

    return message;
  } catch {
    return undefined;
  }
}

export async function waitForEmail(
  mailpitApiUrl: string,
  receiver: string,
): Promise<MailpitMessage | undefined> {
  // Increase retries to better accommodate async email delivery via queues
  const maxRetries = 30;
  const retryDelay = 500; // shorter interval for faster overall wait (max 15s)
  const receiverLower = receiver.toLowerCase();
  attemptLoop: for (let attempt = 1; attempt <= maxRetries; attempt++) {
    // Fetch all messages so we can locate the correct recipient instead of just the latest
    const listResponse = await fetch(`${mailpitApiUrl}/api/v1/messages`);
    if (listResponse.status !== 200) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue attemptLoop;
    }
    const listJson = (await listResponse.json()) as unknown;
    const listData = parseMailpitListResponse(listJson);
    if (!listData) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue attemptLoop;
    }
    // Pick newest message for receiver (Mailpit returns with Created timestamp)
    const candidate = listData.messages
      .filter(message => message.To?.some(to => to.Address?.toLowerCase() === receiverLower))
      .sort((a, b) => {
        const createdA = a.Created ? new Date(a.Created).getTime() : 0;
        const createdB = b.Created ? new Date(b.Created).getTime() : 0;
        return createdB - createdA;
      })[0];

    if (candidate) {
      // Fetch full message details
      const fullResponse = await fetch(`${mailpitApiUrl}/api/v1/message/${candidate.ID}`);
      if (fullResponse.status !== 200) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
        continue attemptLoop;
      }
      const messageJson = (await fullResponse.json()) as unknown;
      const message = validateMailpitMessage(messageJson);
      if (message) {
        return message;
      }

      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue attemptLoop;
    }

    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    } else {
      throw new Error(`Email to ${receiver} not found after ${maxRetries} attempts`);
    }
  }

  return undefined;
}

export async function waitForEmailVerification(mailpitApiUrl: string, receiver: string) {
  const emailMessage = await waitForEmail(mailpitApiUrl, receiver);
  /**
   * @example Hi Verify your email address!\r\n\r\nThanks for signing up with CryptoGadai! We're excited to have you on board.\r\nTo complete your registration and secure your account, please verify your email address by clicking the link below:\r\n\r\nhttps://172.22.0.4:3000/api/auth/verify-email?token=eyJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6InZhbGlkZW1haWxfbWZub3hxMG9AdGVzdC5jb20iLCJpYXQiOjE3NTgwOTU5NzAsImV4cCI6MTc1ODA5OTU3MH0.fV6frfV_qJOV3wUzlsAXIv9zPmY1ahwHQ-Qmy76oQaY&callbackURL=/account-type?referrer=signup\r\n\r\nSecurity Note: This verification link will expire in 24 hours for your security.\r\nIf you didn't create an account with us, you can safely ignore this email.\r\n\r\nThis email was sent by CryptoGadai\r\nIf you have any questions, feel free to contact our support team.\r\n\r\n© 2025 CryptoGadai. All rights reserved.'
   */
  const emailText = emailMessage?.Text ?? 'EMPTY_TEXT_BODY';
  const emailHtml = emailMessage?.HTML ?? 'EMPTY_HTML_BODY';
  // Try text first, then HTML fallback (strip attributes, look for href)
  const extractedVerificationLink =
    emailText.match(/https?:\/\/[^\s]+/g)?.[0] ||
    emailHtml.match(/https?:\/\/[^"'\s>]+/g)?.[0] ||
    'INVALID';

  ok(
    extractedVerificationLink !== 'INVALID',
    `Failed to extract verification link from email. Email text: ${emailText}. Email HTML: ${emailHtml}`,
  );

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
    // console.debug(
    //   `Looking for password reset email to ${receiver}, attempt ${attempt} of ${maxRetries}`,
    // );

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
      // console.debug(`Password reset email found for ${receiver} on attempt ${attempt}`);

      // Fetch the full email content using the message ID
      const fullEmailResponse = await fetch(
        `${mailpitApiUrl}/api/v1/message/${passwordResetEmail.ID}`,
      );
      if (fullEmailResponse.status !== 200) {
        throw new Error(`Failed to fetch full email: ${fullEmailResponse.statusText}`);
      }

      const fullEmail = await fullEmailResponse.json();
      assertDefined(fullEmail);
      assertPropString(fullEmail, 'Text');
      assertPropString(fullEmail, 'HTML');
      const emailText = fullEmail.Text ?? 'INVALID';
      const emailHtml = fullEmail.HTML ?? 'INVALID';

      // Try to extract from both text and HTML
      const emailContent = emailText !== 'INVALID' ? emailText : emailHtml;

      // Extract the password reset link from the email
      const extractedResetLink =
        emailContent.match(/https?:\/\/[^\s<>"]+/g)?.[0] ??
        emailContent.match(/http:\/\/[^\s<>"]+/g)?.[0] ??
        'INVALID';
      // console.info('Extracted Password Reset Link:', extractedResetLink);

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
      // console.debug(
      //   `Password reset email not found for ${receiver}, retrying in ${retryDelay / 1000} seconds...`,
      // );
      await new Promise(res => setTimeout(res, retryDelay));
    }
  }

  throw new Error(`Password reset email not found for ${receiver} after ${maxRetries} attempts`);
}
