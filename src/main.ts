/**
 * Application entry point.
 */

import 'dotenv/config';
import { load_config } from './config.js';
import { set_log_level } from './utils/logger.js';
import { create_app } from './server.js';
import { ProviderRegistry } from './providers/registry.js';
import { GoogleTtsProvider } from './providers/google.js';
import { EdgeTtsProvider } from './providers/edge-tts.js';
import { OpenaiFmProvider } from './providers/openai-fm.js';
import { init_auth } from './middleware/auth.js';
import { init_cache } from './middleware/cache.js';
import { logger } from './utils/logger.js';

function main(): void {
  // Load configuration (config.json merged with env vars)
  const config = load_config();

  // Apply log level from config (env takes priority via load_config)
  set_log_level(config.log_level);

  // Initialize authentication and caching from config
  init_auth(config.api_keys.length > 0 ? config.api_keys.join(',') : undefined);
  init_cache(config.cache?.tts_size);

  const registry = new ProviderRegistry();

  registry.register(new GoogleTtsProvider(config.providers?.['google-translate']));
  registry.register(new EdgeTtsProvider());
  registry.register(new OpenaiFmProvider(config.providers?.['openai-fm']));

  logger.info('providers registered', {
    providers: registry.get_provider_names(),
    models: registry.get_all_models(),
  });

  const app = create_app(registry);

  app.listen(config.port, () => {
    logger.info('server started', { port: config.port });
  });
}

main();
