import crypto from 'crypto';
import { db } from '../../db/knex';

const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface RefreshTokenRow {
  id: number;
  user_id: number;
  token_hash: string;
  expires_at: Date | string;
  revoked_at: Date | string | null;
  replaced_by_id: number | null;
}

export interface SessionMeta {
  deviceLabel: string | null;
  ip: string | null;
}

function hashRefreshToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export async function createRefreshToken(userId: number, meta: SessionMeta): Promise<string> {
  const rawToken = crypto.randomBytes(40).toString('hex');
  await db('refresh_tokens').insert({
    user_id: userId,
    token_hash: hashRefreshToken(rawToken),
    device_label: meta.deviceLabel,
    ip: meta.ip,
    expires_at: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return rawToken;
}

export type RotateResult =
  | { status: 'ok'; userId: number; rawToken: string }
  | { status: 'reused'; userId: number }
  | { status: 'invalid' };

// Rotation: the presented token is revoked and a fresh one takes its place,
// linked via replaced_by_id. Presenting a token that's already revoked *by
// a prior rotation* (replaced_by_id set) means it was stolen and used after
// the legitimate client already rotated past it — the whole session family
// for that user is revoked in response, not just this one token.
export async function rotateRefreshToken(rawToken: string, meta: SessionMeta): Promise<RotateResult> {
  const row = await db<RefreshTokenRow>('refresh_tokens').where({ token_hash: hashRefreshToken(rawToken) }).first();
  if (!row) return { status: 'invalid' };

  if (row.revoked_at !== null) {
    if (row.replaced_by_id !== null) {
      await revokeAllForUser(row.user_id);
      return { status: 'reused', userId: row.user_id };
    }
    return { status: 'invalid' };
  }

  if (new Date(row.expires_at).getTime() < Date.now()) {
    return { status: 'invalid' };
  }

  const newRawToken = await createRefreshToken(row.user_id, meta);
  const newRow = await db<RefreshTokenRow>('refresh_tokens').where({ token_hash: hashRefreshToken(newRawToken) }).first();
  await db('refresh_tokens').where({ id: row.id }).update({ revoked_at: db.fn.now(), replaced_by_id: newRow!.id });

  return { status: 'ok', userId: row.user_id, rawToken: newRawToken };
}

// Only this session, not requireAuth-gated — see auth.routes.ts's /logout.
// A missing/already-revoked token is a no-op, same shape as elsewhere in the app.
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await db('refresh_tokens').where({ token_hash: hashRefreshToken(rawToken), revoked_at: null }).update({ revoked_at: db.fn.now() });
}

export async function revokeAllForUser(userId: number): Promise<void> {
  await db('refresh_tokens').where({ user_id: userId, revoked_at: null }).update({ revoked_at: db.fn.now() });
}
