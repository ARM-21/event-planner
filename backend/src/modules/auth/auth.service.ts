/**
 * Data access for auth: everything that touches the `users` table. Routes
 * call these instead of querying `db` directly, so `auth.routes.ts` only
 * has to deal with request/response shaping and business rules.
 */

import { db } from '../../db/knex';

export interface UserRow {
  id: number;
  name: string;
  email: string;
  password_hash: string;
  email_verified_at: Date | string | null;
  token_version: number;
}

export function toPublicUser(row: Pick<UserRow, 'id' | 'name' | 'email' | 'email_verified_at'>) {
  return { id: row.id, name: row.name, email: row.email, emailVerified: row.email_verified_at !== null };
}

export async function findUserByEmail(email: string): Promise<UserRow | undefined> {
  return db<UserRow>('users').where({ email }).first();
}

export async function findUserById(id: number): Promise<UserRow | undefined> {
  return db<UserRow>('users').where({ id }).first();
}

export async function createUser(input: { name: string; email: string; passwordHash: string }): Promise<number> {
  const [id] = await db('users').insert({ name: input.name, email: input.email, password_hash: input.passwordHash });
  return id;
}

// The sole write path for revocation: bumping this invalidates every
// outstanding refresh token issued to the user (see `POST /auth/refresh`'s
// `ver` check in `auth.routes.ts`).
export async function incrementTokenVersion(userId: number): Promise<void> {
  await db('users').where({ id: userId }).increment('token_version', 1);
}
