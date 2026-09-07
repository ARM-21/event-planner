import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import compression from 'compression';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './modules/auth/auth.routes';
import eventsRoutes from './modules/events/events.routes';
import tagsRoutes from './modules/tags/tags.routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { apiLimiter, authLimiter } from './middleware/rateLimit';
import { env } from './config/env';
import { db } from './db/knex';
import { openApiSpec } from './docs/openapi';

export const app = express();

// only trust X-Forwarded-For when actually behind a proxy/load balancer
if (env.trustProxy) {
  app.set('trust proxy', 1);
}

// CSP off: swagger-ui-express needs inline scripts/styles it would block
app.use(helmet({ contentSecurityPolicy: false }));
// credentials: true so the browser sends/accepts the httpOnly refresh cookie cross-origin
app.use(cors({ origin: env.corsOrigins, credentials: true }));
app.use(compression());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
app.disable('x-powered-by');
app.use(requestLogger);
app.use('/api', apiLimiter);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.get('/api/health', async (_req, res) => {
  try {
    await db.raw('SELECT 1');
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'db unreachable' });
  }
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/tags', tagsRoutes);

app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

app.use(errorHandler);
