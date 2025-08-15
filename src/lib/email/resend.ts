import 'dotenv/config';

import { Resend } from 'resend';
import invariant from 'tiny-invariant';

const resendApiKey = process.env.RESEND_API_KEY;
invariant(resendApiKey, 'Internal RESEND_API_KEY environment variable must be defined');

export const resend = new Resend(resendApiKey!);
