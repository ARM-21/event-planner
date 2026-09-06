/**
 * Handles the one-time tokens used for email verification links.
 *
 * A random token is generated and emailed to the user; only its hash is
 * ever stored in the database, the same way a password is hashed, so
 * nobody who can read the database can reconstruct a working link.
 */

import crypto from 'crypto';
import { db } from '../../db/knex';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

// Verification links are matched by looking up this hash, never the raw
// token — mirrors how passwords are never stored in plain text either.
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// One active token per user at a time — issuing a new one (register, or a
// resend) supersedes whatever link was sent before. The delete+insert runs
// as one transaction so a failure between the two steps can't leave the
// user with the old token gone and no new one in its place.
export async function createVerificationToken(userId: number): Promise<string> {
  const rawToken = crypto.randomBytes(32).toString('hex');
  await db.transaction(async (trx) => {
    await trx('email_verifications').where({ user_id: userId }).delete();
    await trx('email_verifications').insert({
      user_id: userId,
      token_hash: hashToken(rawToken),
      expires_at: new Date(Date.now() + TOKEN_TTL_MS),
    });
  });
  return rawToken;
}

// Looks up the raw token from an emailed link, checks it hasn't expired,
// and — if valid — marks the owning user verified and consumes the token
// (deletes it) in one transaction so it can't be replayed. Returns `null`
// for any failure case (not found or expired); the route doesn't need to
// distinguish which, so callers get one outcome to check.
export async function consumeVerificationToken(rawToken: string): Promise<{ userId: number } | null> {
  const record = await db<{ id: number; user_id: number; token_hash: string; expires_at: Date | string }>(
    'email_verifications',
  )
    .where({ token_hash: hashToken(rawToken) })
    .first();

  if (!record || new Date(record.expires_at).getTime() < Date.now()) {
    return null;
  }

  await db.transaction(async (trx) => {
    await trx('users').where({ id: record.user_id }).update({ email_verified_at: trx.fn.now() });
    await trx('email_verifications').where({ id: record.id }).delete();
  });

  return { userId: record.user_id };
}
