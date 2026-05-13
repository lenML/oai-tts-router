/**
 * Express app creation and configuration.
 * Providers can be registered before creating the app.
 */

import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Router } from 'express';
import { register_audio_routes } from './routes/audio.js';
import { register_models_routes } from './routes/models.js';
import { ProviderRegistry } from './providers/registry.js';
import { error_handler } from './errors.js';

const playground_dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'playground',
);

/** Create an Express application instance */
export function create_app(registry: ProviderRegistry): express.Application {
  const app = express();
  const router = Router();

  // Global middleware
  app.use(cors());
  app.use(express.json());

  // Serve playground
  app.use(express.static(playground_dir));

  // Register routes
  register_audio_routes(router, registry);
  register_models_routes(router, registry);
  app.use(router);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Error handler
  app.use(error_handler);

  return app;
}
