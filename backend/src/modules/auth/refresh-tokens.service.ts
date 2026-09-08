import crypto from 'crypto';
import type { Knex } from 'knex';
import { db } from '../../db/knex';
import type { RefreshTokenRow, RefreshTokenRowWithValidity, SessionMeta, RotateResult } from './auth.types';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// executor defaults to the top-level db, but rotateRefreshToken passes its
// trx so the insert participates in the same transaction as the old row's revoke.
export async function createRefreshToken(
  userId: number,
  meta: SessionMeta,
  executor: Knex | Knex.Transaction = db,
): Promise<{ rawToken: string; id: number }> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  const [id] = await executor('refresh_tokens').insert({
    user_id: userId,
    token_hash: hashRefreshToken(rawToken),
    device_label: meta.deviceLabel,
    ip: meta.ip,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return { rawToken, id };
}

// Rotation: the presented token is revoked and a fresh one takes its place,
// linked via replaced_by_id. A token that's already revoked *by a prior
// rotation* means it was stolen — revoke the whole session family, not just this token.
export async function rotateRefreshToken(rawToken: string, meta: SessionMeta): Promise<RotateResult> {
  return db.transaction(async (trx) => {
    // forUpdate locks the row so two concurrent requests can't both rotate
    // the same token and each create their own replacement.
    const row = await trx<RefreshTokenRowWithValidity>('refresh_tokens')
      .select('*', trx.raw('(expires_at > ?) as still_valid', [trx.fn.now()]))
      .where({ token_hash: hashRefreshToken(rawToken) })
      .forUpdate()
      .first();
    if (!row) return { status: 'invalid' };

    if (row.revoked_at !== null) {
      if (row.replaced_by_id !== null) {
        await revokeAllForUser(row.user_id, trx);
        return { status: 'reused', userId: row.user_id };
      }
      return { status: 'invalid' };
    }

    if (!row.still_valid) {
      return { status: 'invalid' };
    }

    const { rawToken: newRawToken, id: newId } = await createRefreshToken(row.user_id, meta, trx);
    await trx('refresh_tokens').where({ id: row.id }).update({ revoked_at: trx.fn.now(), replaced_by_id: newId });

    return { status: 'ok', userId: row.user_id, rawToken: newRawToken };
  });
}

// Only this session, not requireAuth-gated — see auth.routes.ts's /logout.
// A missing/already-revoked token is a no-op, same shape as elsewhere in the app.
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await db('refresh_tokens').where({ token_hash: hashRefreshToken(rawToken), revoked_at: null }).update({ revoked_at: db.fn.now() });
}

export async function revokeAllForUser(userId: number, executor: Knex | Knex.Transaction = db): Promise<void> {
  await executor('refresh_tokens').where({ user_id: userId, revoked_at: null }).update({ revoked_at: executor.fn.now() });
}
