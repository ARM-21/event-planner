import type { Knex } from 'knex';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '.env') });

const config: Knex.Config = {
  client: 'mysql2',
  connection: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'event_planner_app',
    password: process.env.DB_PASSWORD ?? 'change_me',
    database: process.env.DB_NAME ?? 'event_planner',
    charset: 'utf8mb4',
    timezone: 'Z',
  },
  migrations: {
    directory: path.resolve(__dirname, 'migrations'),
    tableName: 'knex_migrations',
    extension: 'ts',
  },
  pool: { min: 0, max: 10 },
};

export default config;
