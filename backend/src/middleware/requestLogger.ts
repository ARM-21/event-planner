/**
 * Access-log middleware — logs one line per request (method, URL, status
 * code, and how long it took) once the response has actually been sent.
 * This is the API's equivalent of a web server's access log.
 */

import type { NextFunction, Request, Response } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startedAt = Date.now();
  res.on('finish', () => {
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - startedAt}ms`);
  });
  next();
}
