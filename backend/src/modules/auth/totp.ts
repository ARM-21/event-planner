import crypto from 'crypto';
import { OTP } from 'otplib';
import QRCode from 'qrcode';
import { env } from '../../config/env';

const otp = new OTP(); // TOTP, 6 digits, 30s period, SHA-1

// Can't be hashed: the server needs the plain secret to compute codes. AES-256-GCM with a
// fresh random IV per call, stored as "iv.tag.ciphertext"; a wrong key or edited value throws.
export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', env.totpEncryptionKey, iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((part) => part.toString('base64')).join('.');
}

export function decryptTotpSecret(stored: string): string {
  const [iv, tag, data] = stored.split('.').map((part) => Buffer.from(part, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', env.totpEncryptionKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

export function generateTotpSecret(): string {
  return otp.generateSecret();
}

export async function generateTotpQrCode(email: string, secret: string): Promise<string> {
  const uri = otp.generateURI({ issuer: 'Evently', label: email, secret });
  return QRCode.toDataURL(uri);
}

// epochTolerance absorbs clock drift between server and phone
export async function verifyTotpCode(secret: string, code: string): Promise<boolean> {
  const result = await otp.verify({ secret, token: code, epochTolerance: 30 });
  return result.valid;
}

// Dev convenience only — lets us read the currently-valid code off the
// server console instead of an authenticator app. Callers must gate this
// on env.nodeEnv !== 'production'.
export async function getCurrentTotpCode(secret: string): Promise<string> {
  return otp.generate({ secret });
}
