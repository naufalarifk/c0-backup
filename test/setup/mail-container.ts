import { GenericContainer, type StartedTestContainer, Wait } from 'testcontainers';
import invariant from 'tiny-invariant';

export interface MailpitMessage {
  ID: string;
  MessageID: string;
  Read: boolean;
  From: {
    Name: string;
    Address: string;
  };
  To: Array<{
    Name: string;
    Address: string;
  }>;
  ReplyTo: string[];
  Subject: string;
  Created: string;
  Username: string;
  Tags: string[];
  Size: number;
  Attachments: number;
  Snippet: string;
}

export interface MailpitMessagesResponse {
  total: number;
  unread: number;
  count: number;
  messages_count: number;
  messages_unread: number;
  start: number;
  tags: string[];
  messages: MailpitMessage[];
}

export default class MailContainer {
  private container: StartedTestContainer | null = null;
  private smtpPort: number;
  private httpPort: number;
  private host: string;
  // private transporter: Transporter | null = null;

  async start(): Promise<void> {
    invariant(!this.container, 'MailContainer is already started');

    console.log('Starting Mailpit container...');
    this.container = await new GenericContainer('axllent/mailpit:v1.27.7')
      .withExposedPorts(1025, 8025)
      .withWaitStrategy(Wait.forListeningPorts())
      .withStartupTimeout(60_000)
      .start();

    this.smtpPort = this.container.getMappedPort(1025);
    this.httpPort = this.container.getMappedPort(8025);
    this.host = this.container.getHost();

    console.log(`Mailpit started!`);
    console.log(`  SMTP: ${this.host}:${this.smtpPort}`);
    console.log(`  Web UI: http://${this.host}:${this.httpPort}`);
  }

  async stop() {
    if (this.container) {
      await this.container.stop();
      this.container = null;
    }
  }

  getSmtpConfig() {
    if (!this.container) {
      throw new Error('Container is not running');
    }
    return {
      host: this.host,
      port: this.smtpPort,
      secure: false,
      tls: {
        rejectUnauthorized: false,
      },
    };
  }

  getHost(): string {
    return this.host;
  }

  getSmtpPort(): number {
    return this.smtpPort;
  }

  getHttpPort(): number {
    return this.httpPort;
  }

  getApiUrl(): string {
    if (!this.container) {
      throw new Error('Container is not running');
    }
    return `http://${this.host}:${this.httpPort}/api/v1`;
  }

  getWebUrl(): string {
    if (!this.container) {
      throw new Error('Container is not running');
    }
    return `http://${this.host}:${this.httpPort}`;
  }
}
