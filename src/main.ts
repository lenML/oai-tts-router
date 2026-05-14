/**
 * Application entry point.
 */

import 'dotenv/config';
import { create_app } from './server.js';
import { ProviderRegistry } from './providers/registry.js';
import { GoogleTtsProvider } from './providers/google.js';
import { EdgeTtsProvider } from './providers/edge-tts.js';
import { OpenaiFmProvider } from './providers/openai-fm.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);

function main(): void {
  const registry = new ProviderRegistry();

  registry.register(new GoogleTtsProvider());
  registry.register(new EdgeTtsProvider());
  registry.register(new OpenaiFmProvider());

  const app = create_app(registry);

  app.listen(PORT, () => {
    console.log(`oai-tts-router listening on http://0.0.0.0:${String(PORT)}`);
  });
}

main();
