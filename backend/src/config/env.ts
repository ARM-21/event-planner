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
  corsOrigins: (process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === '1',
};
