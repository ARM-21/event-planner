import type { Knex } from 'knex';

// Added nullable first and backfilled rather than a straight NOT NULL add,
// so this doesn't fail against a table that already has rows.
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable('events', (table) => {
    table.datetime('ends_at').nullable();
  });
  await knex.raw('UPDATE `events` SET `ends_at` = DATE_ADD(`starts_at`, INTERVAL 30 MINUTE) WHERE `ends_at` IS NULL');
  await knex.raw('ALTER TABLE `events` MODIFY `ends_at` DATETIME NOT NULL');
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable('events', (table) => {
    table.dropColumn('ends_at');
  });
}
