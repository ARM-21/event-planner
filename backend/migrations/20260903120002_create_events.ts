import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('events', (table) => {
    table.bigIncrements('id').unsigned().primary();
    table
      .bigInteger('creator_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.string('title', 150).notNullable();
    table.text('description').nullable();
    table.datetime('starts_at').notNullable();
    table.string('location', 255).notNullable();
    table.enum('visibility', ['public', 'private'], {
      useNative: true,
      enumName: 'events_visibility',
    }).notNullable().defaultTo('public');
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());

    table.index(['starts_at'], 'events_starts_at_idx');
    table.index(['creator_id'], 'events_creator_id_idx');
    table.index(['visibility', 'starts_at'], 'events_visibility_starts_at_idx');
  });

  await knex.raw(
    "ALTER TABLE `events` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci",
  );
  await knex.raw(
    "ALTER TABLE `events` MODIFY `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('events');
}
