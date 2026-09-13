import type { Knex } from 'knex';
import { decryptTotpSecret, encryptTotpSecret } from '../src/modules/auth/totp';

// Encrypted value is "iv.tag.ciphertext" in base64, longer than the old 64 char plain secret.
// A plain base32 secret never contains ".", which is how existing rows are told apart.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.string('totp_secret', 255).nullable().alter();
  });

  const rows = await knex('users').whereNotNull('totp_secret').whereNot('totp_secret', 'like', '%.%').select('id', 'totp_secret');
  for (const row of rows) {
    await knex('users').where({ id: row.id }).update({ totp_secret: encryptTotpSecret(row.totp_secret) });
  }
}

export async function down(knex: Knex): Promise<void> {
  const rows = await knex('users').where('totp_secret', 'like', '%.%').select('id', 'totp_secret');
  for (const row of rows) {
    await knex('users').where({ id: row.id }).update({ totp_secret: decryptTotpSecret(row.totp_secret) });
  }

  await knex.schema.alterTable('users', (table) => {
    table.string('totp_secret', 64).nullable().alter();
  });
}
