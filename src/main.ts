/**
 * Application entry point.
 */

import 'dotenv/config';
import { create_app } from './server.js';
import { ProviderRegistry } from './providers/registry.js';
import { GoogleTtsProvider } from './providers/google.js';
import { EdgeTtsProvider } from './providers/edge-tts.js';
import { OpenaiFmProvider } from './providers/openai-fm.js';
import { init_auth } from './middleware/auth.js';
import { init_cache } from './middleware/cache.js';
import { logger } from './utils/logger.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

function main(): void {
  // Initialize authentication and caching from environment
  init_auth(process.env.API_KEY);
  init_cache(process.env.TTS_CACHE_SIZE);

  const registry = new ProviderRegistry();

  registry.register(new GoogleTtsProvider());
  registry.register(new EdgeTtsProvider());
  registry.register(new OpenaiFmProvider());

  logger.info('providers registered', {
    providers: registry.get_provider_names(),
    models: registry.get_all_models(),
  });

  const app = create_app(registry);

  app.listen(PORT, () => {
    logger.info('server started', { port: PORT });
  });
}

main();
