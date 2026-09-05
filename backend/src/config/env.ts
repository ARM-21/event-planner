/**
 * App configuration, read once from environment variables (via a local
 * .env file in development). Every other file that needs a setting —
 * database credentials, the JWT secret, log level, allowed CORS origins,
 * and so on — imports `env` from here instead of reading `process.env`
 * directly, so all the defaults and validation live in one place.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET'),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  nodeEnv,
  logLevel: process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'http' : 'debug'),
  // Origins allowed to call the API. Defaults to FRONTEND_URL; set CORS_ORIGIN
  corsOrigins: (process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  // Only true when actually behind a reverse proxy/load balancer (set
  // TRUST_PROXY=1 there) — needed so rate-limiting and req.ip see the real
  // client IP from X-Forwarded-For instead of the proxy's.
  trustProxy: process.env.TRUST_PROXY === '1',
};
