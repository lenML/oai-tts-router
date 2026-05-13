/**
 * Application entry point.
 */

import { create_app } from "./server.js";
import { ProviderRegistry } from "./providers/registry.js";

const PORT = parseInt(process.env.PORT ?? "3000", 10);

function main(): void {
  const registry = new ProviderRegistry();

  // TODO: Register actual TTS providers here
  // registry.register(new SomeProvider());

  const app = create_app(registry);

  app.listen(PORT, () => {
    console.log(`oai-tts-router listening on http://0.0.0.0:${String(PORT)}`);
  });
}

main();
