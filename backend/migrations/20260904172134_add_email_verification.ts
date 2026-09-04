import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.datetime('email_verified_at').nullable();
  });

  await knex.schema.createTable('email_verifications', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    // sha256 hex digest of the raw token that's emailed — only the hash is
    // ever stored, same reasoning as password_hash.
    table.string('token_hash', 64).notNullable().unique();
    table.datetime('expires_at').notNullable();
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.index('user_id');
  });

  await knex.raw(
    'ALTER TABLE `email_verifications` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci',
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('email_verifications');
  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('email_verified_at');
  });
}
