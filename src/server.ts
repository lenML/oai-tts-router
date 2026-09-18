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
import type { CorsConfig } from './config.js';

const playground_dir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'playground',
  'dist',
);

const DEFAULT_CORS_CONFIG: CorsConfig = { origin: ['*'] };

/** Create an Express application instance */
export function create_app(
  registry: ProviderRegistry,
  cors_config: CorsConfig = DEFAULT_CORS_CONFIG,
): express.Application {
  const app = express();
  const router = Router();
  const allowed_origins = cors_config.origin.includes('*') ? '*' : cors_config.origin;

  // Global middleware
  app.use(cors({ origin: allowed_origins }));
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
