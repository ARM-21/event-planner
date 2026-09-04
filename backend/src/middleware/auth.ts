import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { unauthorized } from '../utils/errors';

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next(unauthorized('Missing or invalid Authorization header'));
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const sub = typeof payload === 'string' ? payload : payload.sub;
    const userId = Number(sub);
    if (!sub || Number.isNaN(userId)) {
      next(unauthorized('Invalid or expired token'));
      return;
    }
    req.userId = userId;
    next();
  } catch {
    next(unauthorized('Invalid or expired token'));
  }
}

// Identity is optional (e.g. GET /events, where an anonymous caller sees
// only public events but an authenticated one also sees their own private
// ones) — a missing or invalid token means "anonymous", not a 401.
export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    next();
    return;
  }

  const token = header.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const sub = typeof payload === 'string' ? payload : payload.sub;
    const userId = Number(sub);
    if (sub && !Number.isNaN(userId)) {
      req.userId = userId;
    }
  } catch {
    // invalid/expired token on an optional-auth route — treat as anonymous
  }
  next();
}
