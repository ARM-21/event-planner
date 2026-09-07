import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

interface StatusError extends Error {
  status?: number;
  statusCode?: number;
}

// e.g. malformed JSON from express.json() — a client mistake, not a 500
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
