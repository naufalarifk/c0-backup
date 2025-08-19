import 'express';

import { UserSession } from '../modules/auth/auth.types';

declare module 'express' {
  interface Request {
    session?: UserSession | null;
    user?: UserSession['user'] | null;
  }
}
