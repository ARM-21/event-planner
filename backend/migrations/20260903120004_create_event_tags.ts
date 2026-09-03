import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('event_tags', (table) => {
    table
      .bigInteger('event_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('events')
      .onDelete('CASCADE');
    table
      .bigInteger('tag_id')
      .unsigned()
      .notNullable()
      .references('id')
      .inTable('tags')
      .onDelete('CASCADE');

    table.primary(['event_id', 'tag_id']);
    table.index(['tag_id', 'event_id'], 'event_tags_tag_id_event_id_idx');
  });

  await knex.raw(
    "ALTER TABLE `event_tags` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci",
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('event_tags');
}
