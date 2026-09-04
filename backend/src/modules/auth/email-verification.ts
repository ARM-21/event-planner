import crypto from 'crypto';
import { db } from '../../db/knex';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// One active token per user at a time — issuing a new one (register, or a
// resend) supersedes whatever link was sent before.
export async function createVerificationToken(userId: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  await db('email_verifications').where({ user_id: userId }).delete();
  await db('email_verifications').insert({
    user_id: userId,
    token_hash: hashToken(rawToken),
    expires_at: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return rawToken;
}
