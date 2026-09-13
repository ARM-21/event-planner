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

// AES-256 needs exactly 32 bytes; fail at boot rather than on someone's 2FA login.
function encryptionKey(name: string): Buffer {
  const key = Buffer.from(required(name), 'base64');
  if (key.length !== 32) {
    throw new Error(`${name} must be 32 bytes, base64 encoded (openssl rand -base64 32)`);
  }
  return key;
}

const nodeEnv = process.env.NODE_ENV ?? 'development';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: required('JWT_SECRET'),
  totpEncryptionKey: encryptionKey('TOTP_ENCRYPTION_KEY'),
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  nodeEnv,
  logLevel: process.env.LOG_LEVEL ?? (nodeEnv === 'production' ? 'http' : 'debug'),
  corsOrigins: (process.env.CORS_ORIGIN ?? process.env.FRONTEND_URL ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  trustProxy: process.env.TRUST_PROXY === '1',
  // Unset in dev: mailer.ts falls back to console-logging instead of sending.
  resendApiKey: process.env.RESEND_API_KEY,
  emailFrom: process.env.EMAIL_FROM ?? 'Evently <onboarding@resend.dev>',
};
