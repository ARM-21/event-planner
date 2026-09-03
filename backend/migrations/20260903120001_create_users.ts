import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('users', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.string('name', 100).notNullable();
    table.string('email', 255).notNullable().unique();
    table.string('password_hash', 255).notNullable();
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    "ALTER TABLE `users` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci",
  );
  await knex.raw(
    "ALTER TABLE `users` MODIFY `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('users');
}
