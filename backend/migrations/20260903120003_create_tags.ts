import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('tags', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table.string('name', 50).notNullable().unique();
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
  });

  await knex.raw(
    "ALTER TABLE `tags` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('tags');
}
