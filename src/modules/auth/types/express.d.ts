import 'express';

import { UserSession } from './auth.types';

declare module 'express' {
  interface Request {
    session?: UserSession | null;
    user?: UserSession['user'] | null;
  }
}
