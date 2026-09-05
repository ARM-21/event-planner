/**
 * The single, shared database connection used by every route/service in
 * the app. Built from the same `knexfile.ts` config that the migration
 * CLI (`npm run migrate:*`) uses, so the app and the migrations always
 * agree on how to reach the database.
 */

import Knex from 'knex';
import knexConfig from '../../knexfile';

export const db = Knex(knexConfig);
