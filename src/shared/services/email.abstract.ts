import type { CreateEmailOptions, CreateEmailRequestOptions } from 'resend';

export type EmailPayload = Omit<CreateEmailOptions, 'from'> & {
  from?: string;
};

export abstract class EmailService {
  abstract sendEmail(
    payload: EmailPayload,
    options?: CreateEmailRequestOptions,
  ): Promise<{ data: { id: string } | null; error: Error | null }>;

  abstract getClient(): unknown;
}
