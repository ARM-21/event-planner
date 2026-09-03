import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import authRoutes from './modules/auth/auth.routes';
import { errorHandler } from './middleware/errorHandler';
import { db } from './db/knex';
import { openApiSpec } from './docs/openapi';

export const app = express();

app.use(cors());
app.use(express.json());

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

app.use(errorHandler);
