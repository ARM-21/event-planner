import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('refresh_tokens', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.string('token_hash', 64).notNullable().unique();
    table.string('device_label', 255).nullable();
    table.string('ip', 45).nullable();
    table.datetime('expires_at').notNullable();
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('revoked_at').nullable();
    table.bigInteger('replaced_by_id').unsigned().nullable();
    table.foreign('replaced_by_id').references('id').inTable('refresh_tokens').onDelete('SET NULL');
    table.index('user_id');
  });

  await knex.raw('ALTER TABLE `refresh_tokens` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');

  await knex.schema.alterTable('users', (table) => {
    table.dropColumn('token_version');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('users', (table) => {
    table.integer('token_version').unsigned().notNullable().defaultTo(0);
  });
  await knex.schema.dropTableIfExists('refresh_tokens');
}
