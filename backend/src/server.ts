/**
 * Entry point: starts the HTTP server and handles shutting it down cleanly.
 *
 * Running `npm run dev` (or `npm start` in production) executes this file.
 * It takes the Express app built in app.ts and makes it actually listen
 * for requests, and makes sure that stopping the process (e.g. Ctrl+C)
 * finishes in-flight requests and closes the database connection first
 * instead of dropping them abruptly.
 */

import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { db } from './db/knex';

const server = app.listen(env.port, () => {
  logger.info(`event-planner API listening on port ${env.port}`);
});

// Stops accepting new connections, waits for in-flight requests to finish,
// then closes the database pool before actually exiting the process.
function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`);
  server.close(async (err) => {
    if (err) {
      logger.error('Error while closing HTTP server', { error: err.message });
    }
    try {
      await db.destroy();
    } catch (dbErr) {
      logger.error('Error while closing DB pool', { error: dbErr instanceof Error ? dbErr.message : dbErr });
    }
    process.exit(err ? 1 : 0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
