/**
 * Mailpit testing utilities for E2E tests
 */

import invariant from 'tiny-invariant';

export interface MailpitMessage {
  ID: string;
  MessageID: string;
  Subject: string;
  Text?: string;
  HTML?: string;
  To: Array<{ Address: string; Name: string }>;
  From: { Address: string; Name: string };
  Date?: string;
  Created?: string;
  Size: number;
  Tags?: string[];
  Attachments?: number;
  Snippet?: string;
}

export interface MailpitResponse {
  total: number;
  unread: number;
  count: number;
  messages_count: number;
  start: number;
  messages: MailpitMessage[];
}

export class MailpitHelper {
  private static getBaseUrl(): string {
    const host = process.env.MAIL_HOST || 'localhost';
    const port = process.env.MAIL_HTTP_PORT || '8025';
    return `http://${host}:${port}/api/v1`;
  }

  /**
   * Fetch all messages from Mailpit
   */
  static async getAllMessages(): Promise<MailpitMessage[]> {
    const response = await fetch(`${this.getBaseUrl()}/messages`);
    invariant(response.ok, `Failed to fetch emails: ${response.statusText}`);

    const data: MailpitResponse = await response.json();
    return data.messages || [];
  }

  /**
   * Find the latest email for a specific recipient
   */
  static async getLatestEmailForUser(email: string): Promise<MailpitMessage> {
    const messages = await this.getAllMessages();

    const userEmail = messages.find(msg => msg.To?.some(recipient => recipient.Address === email));

    invariant(userEmail, `No email found for user: ${email}`);

    return userEmail;
  }

  /**
   * Get email content by message ID
   */
  static async getEmailContent(messageId: string): Promise<MailpitMessage> {
    const response = await fetch(`${this.getBaseUrl()}/message/${messageId}`);
    invariant(response.ok, `Failed to fetch email content: ${response.statusText}`);

    return response.json();
  }

  /**
   * Clear all messages from Mailpit
   */
  static async clearAllMessages(): Promise<void> {
    const response = await fetch(`${this.getBaseUrl()}/messages`, {
      method: 'DELETE',
    });

    invariant(response.ok, `Failed to clear messages: ${response.statusText}`);
  }

  /**
   * Wait for an email to arrive for a specific user
   */
  static async waitForEmailForUser(
    email: string,
    timeoutMs: number = 30000,
    pollIntervalMs: number = 1000,
  ): Promise<MailpitMessage> {
    const startTime = Date.now();
    let lastError: Error | null = null;

    while (Date.now() - startTime < timeoutMs) {
      try {
        const emailMessage = await this.getLatestEmailForUser(email);
        console.log(`Email found for ${email} after ${Date.now() - startTime}ms`);
        return emailMessage;
      } catch (error) {
        lastError = error as Error;
        // Email not found yet, wait and retry
        console.log(`Waiting for email for ${email} (${Date.now() - startTime}ms elapsed)...`);
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }
    }

    throw new Error(
      `Timeout waiting for email for user: ${email}. Last error: ${lastError?.message}`,
    );
  }

  /**
   * Get email HTML content (from full message)
   */
  static async getEmailHtml(messageId: string): Promise<string> {
    const message = await this.getEmailContent(messageId);
    return message.HTML || '';
  }

  /**
   * Get email text content (from full message)
   */
  static async getEmailText(messageId: string): Promise<string> {
    const message = await this.getEmailContent(messageId);
    return message.Text || '';
  }

  /**
   * Search messages by criteria
   */
  static async searchMessages(query: string): Promise<MailpitMessage[]> {
    const response = await fetch(`${this.getBaseUrl()}/search?query=${encodeURIComponent(query)}`);
    invariant(response.ok, `Failed to search emails: ${response.statusText}`);

    const data: MailpitResponse = await response.json();
    return data.messages || [];
  }
}
