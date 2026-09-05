/**
 * App-wide logger, built with Winston. Every part of the backend should
 * log through this instead of `console.log`, so output is consistent:
 * colorized and easy to read during development, structured JSON in
 * production (so log-collection tools can parse it).
 */

import winston from 'winston';
import { env } from '../config/env';

const { combine, timestamp, colorize, printf, errors, json } = winston.format;

const devFormat = combine(
  colorize(),
  timestamp({ format: 'HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, stack, ...meta }) => {
    const extra = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${stack ?? message}${extra}`;
  }),
);

export const logger = winston.createLogger({
  level: env.logLevel,
  format: env.nodeEnv === 'production' ? combine(timestamp(), errors({ stack: true }), json()) : devFormat,
  transports: [new winston.transports.Console()],
});
