/**
 * Express app creation and configuration.
 * Providers can be registered before creating the app.
 */

import express from 'express';
import cors from 'cors';
import { Router } from 'express';
import { register_audio_routes } from './routes/audio.js';
import { ProviderRegistry } from './providers/registry.js';
import { error_handler } from './errors.js';

/** Create an Express application instance */
export function create_app(registry: ProviderRegistry): express.Application {
  const app = express();
  const router = Router();

  // Global middleware
  app.use(cors());
  app.use(express.json());

  // Register routes
  register_audio_routes(router, registry);
  app.use(router);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Error handler
  app.use(error_handler);

  return app;
}
