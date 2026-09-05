/**
 * Express application setup.
 *
 * This file wires together everything the API needs on every request:
 * security headers, CORS, request logging, rate limiting, the actual
 * routes (auth/events/tags), the Swagger docs page, and the fallback
 * 404/error handling that runs when nothing else matches. `server.ts` is
 * what actually starts this app listening on a port — this file only
 * builds it.
 */

import express from 'express';
import cors from 'cors';
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

// Only trust X-Forwarded-For when actually deployed behind a proxy/load
// balancer; otherwise req.ip stays the real socket address, which is what
// rate-limiting needs to key on correctly.
if (env.trustProxy) {
  app.set('trust proxy', 1);
}

// CSP is left off: this is a JSON API plus the swagger-ui-express docs page,
// which relies on inline scripts/styles that helmet's default CSP blocks.
// Every other helmet protection (HSTS, noSniff, frameguard, etc.) stays on.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: env.corsOrigins }));
app.use(compression());
// Small cap: this API has no file-upload endpoints, so a legitimate
// request body is never more than a few KB.
app.use(express.json({ limit: '10kb' }));
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

// Unmatched routes fall through to here rather than Express's default HTML
// 404 page, so every response — matched or not — uses the documented error
// envelope.
app.use((_req, res) => {
  res.status(404).json({ error: { message: 'Not found' } });
});

app.use(errorHandler);
