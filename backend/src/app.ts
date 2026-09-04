import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './modules/auth/auth.routes';
import eventsRoutes from './modules/events/events.routes';
import tagsRoutes from './modules/tags/tags.routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { db } from './db/knex';
import { openApiSpec } from './docs/openapi';

export const app = express();

app.use(cors());
app.use(express.json());
app.disable('x-powered-by');
app.use(requestLogger);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.get('/api/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db unreachable' });
  }
});

app.use('/api/auth', authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/tags', tagsRoutes);

// Unmatched routes fall through to here rather than Express's default HTML
// 404 page, so every response — matched or not — uses the documented error
// envelope.
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

app.use(errorHandler);
