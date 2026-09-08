import crypto from 'crypto';
import { db } from '../../db/knex';
import type { EmailVerificationRow } from './auth.types';

const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// one active token per user; delete+insert in one transaction so a failure
// mid-way can't leave the old token gone with no new one in its place
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

export async function consumeVerificationToken(rawToken: string): Promise<{ userId: number } | null> {
  const tokenHash = hashToken(rawToken);

  return await db.transaction(async (trx) => {
    // forUpdate locks the row so two concurrent requests can't both consume the same token
    const record = await trx<EmailVerificationRow>('email_verifications')
      .where({ token_hash: tokenHash })
      .where('expires_at', '>', trx.fn.now())
      .forUpdate()
      .first();

    if (!record) {
      return null;
    }

    // 2. Mark user as verified
    await trx('users')
      .where({ id: record.user_id })
      .update({ email_verified_at: trx.fn.now() });

    // 3. Delete the consumed verification token
    await trx('email_verifications')
      .where({ id: record.id })
      .delete();

    return { userId: record.user_id };
  });
}
