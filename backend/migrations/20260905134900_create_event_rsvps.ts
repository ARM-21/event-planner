import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('event_rsvps', (table) => {
    table
      .bigInteger('event_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('events')
      .onDelete('CASCADE');
    table
      .bigInteger('user_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('users')
      .onDelete('CASCADE');
    table.enum('status', ['going', 'maybe', 'not_going'], {
      useNative: true,
      enumName: 'event_rsvps_status',
    }).notNullable();
    table.datetime('created_at').notNullable().defaultTo(knex.fn.now());
    table.datetime('updated_at').notNullable().defaultTo(knex.fn.now());

    table.primary(['event_id', 'user_id']);
  });

  await knex.raw(
    "ALTER TABLE `event_rsvps` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci",
  );
  await knex.raw(
    "ALTER TABLE `event_rsvps` MODIFY `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_rsvps');
}
