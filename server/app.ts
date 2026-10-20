import express, { type Express } from 'express';
import { apiErrorHandler, apiSecurityMiddleware } from './middleware/security.ts';
import { createApiRouter } from './routes/api.ts';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use('/api', apiSecurityMiddleware);
  app.use('/api', express.json({ limit: '2mb' }));
  app.use('/api', createApiRouter());
  app.use(apiErrorHandler);

  return app;
}
