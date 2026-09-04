import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

interface StatusError extends Error {
  status?: number;
  statusCode?: number;
}

// body-parser (express.json()/urlencoded()) rejects a malformed request body
// with an error carrying its own 4xx status, e.g. bad JSON. That's a client
// mistake, not a server failure, and must not fall through to the 500 below.
function clientErrorStatus(err: StatusError): number | null {
  const status = err.status ?? err.statusCode;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : null;
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  if (err instanceof Error) {
    const status = clientErrorStatus(err);
    if (status !== null) {
      res.status(status).json({ error: { message: err.message } });
      return;
    }
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, {
    error: err instanceof Error ? { message: err.message, stack: err.stack } : err,
  });
  res.status(500).json({ error: { message: 'Internal server error' } });
}
