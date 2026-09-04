import { app } from './app';
import { env } from './config/env';
import { logger } from './utils/logger';

app.listen(env.port, () => {
  logger.info(`event-planner API listening on port ${env.port}`);
});
