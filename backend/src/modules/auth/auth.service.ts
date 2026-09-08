import { db } from '../../db/knex';
import type { UserRow } from './auth.types';

export function toPublicUser(
  row: Pick<UserRow, 'id' | 'name' | 'email' | 'email_verified_at' | 'two_factor_enabled'>,
) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.email_verified_at !== null,
    twoFactorEnabled: Boolean(row.two_factor_enabled),
  };
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

export async function setTotpSecret(userId: number, secret: string): Promise<void> {
  await db('users').where({ id: userId }).update({ totp_secret: secret });
}

export async function enableTwoFactor(userId: number): Promise<void> {
  await db('users').where({ id: userId }).update({ two_factor_enabled: true });
}

export async function disableTwoFactor(userId: number): Promise<void> {
  await db('users').where({ id: userId }).update({ two_factor_enabled: false, totp_secret: null });
}
