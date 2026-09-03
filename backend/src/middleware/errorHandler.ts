import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  console.error(err);
  res.status(500).json({ error: { message: 'Internal server error' } });
}
