/**
 * Models route.
 * Handles GET /v1/models and GET /v1/models/:model.
 */

import { Router } from 'express';
import type { ProviderRegistry } from '../providers/registry.js';

/** Register model-related routes */
export function register_models_routes(router: Router, registry: ProviderRegistry): void {
  router.get('/v1/models', (_req, res) => {
    const models = registry.get_all_models_info();
    res.json({
      object: 'list',
      data: models,
    });
  });

  router.get('/v1/models/:model', (req, res) => {
    const model_id = req.params.model;
    const info = registry.get_model_info(model_id);

    if (!info) {
      res.status(404).json({
        error: {
          message: `Model '${model_id}' not found.`,
          type: 'invalid_request_error',
          param: 'model',
          code: 'model_not_found',
        },
      });
      return;
    }

    res.json(info);
  });
}
