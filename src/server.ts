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
import { bearer_auth, basic_auth } from './middleware/auth.js';
import { request_logger } from './middleware/request-logger.js';

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
  app.use(request_logger);

  // Register routes
  register_audio_routes(router, registry);
  register_models_routes(router, registry);

  // Apply Bearer auth to all /v1/* API routes
  app.use('/v1', bearer_auth);
  app.use(router);

  // Health check (no auth)
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Serve playground under /playground with Basic auth
  app.use('/playground', basic_auth, express.static(playground_dir));

  // Error handler
  app.use(error_handler);

  return app;
}
