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
