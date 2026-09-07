import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';
import { db } from './db/knex';

const server = app.listen(env.port, () => {
  logger.info(`event-planner API listening on port ${env.port}`);
});

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
