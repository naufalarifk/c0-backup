import 'express';

import type { UserSession } from './auth.types';

declare module 'express' {
  interface Request {
    session?: UserSession | null;
    user?: UserSession['user'] | null;
  }
}
