import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
  });
  res.status(500).json({ error: { message: 'Internal server error' } });
}
