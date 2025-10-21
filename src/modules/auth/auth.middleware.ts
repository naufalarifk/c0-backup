import type { NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Injectable } from '@nestjs/common';

import express from 'express';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // skip body parsing for better-auth routes, but allow NestJS controllers
    // under /api/auth/google to have their bodies parsed.
    // Some express/Nest combinations put the controller mount path in baseUrl,
    // while others use originalUrl. Check both to decide.
    const fullPath = req.originalUrl || req.url || '';
    const base = req.baseUrl || '';

    // If request is for /api/auth/google we must allow body parsing (controllers expect parsed JSON)
    if (fullPath.startsWith('/api/auth/google') || base.startsWith('/api/auth/google')) {
      // fall through to body parsing
    } else if (fullPath.startsWith('/api/auth') || base.startsWith('/api/auth')) {
      // skip body parsing for other better-auth routes
      next();
      return;
    }

    // Parse the body as usual
    express.json()(req, res, err => {
      if (err) {
        next(err);
        return;
      }
      express.urlencoded({ extended: true })(req, res, next);
    });
  }
}
