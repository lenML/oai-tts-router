## Project

OpenAI TTS compatible proxy/router. Routes `/v1/audio/speech` to pluggable TTS providers.

## Key architecture

- Route validates `model`+`input` via `tts_request_base` (zod), then delegates to `TtsProvider`.
- Providers optionally define a `request_schema` (extends base) for their own fields.
- All provider-specific params go into `SpeechParams.extra` as `Record<string, unknown>`.
- Errors follow OpenAI JSON format, produced via `OpenAiError` or `openai_error_from_zod()`.

## Reference files

**Coding conventions**
`docs/dev/coding/ts.md` and `docs/dev/coding/clean-code.ts`

**OpenAI TTS API spec**
`docs/dev/openai-tts-api-spec.md`

**Provider interface**
`src/types/provider.ts`

**Request schemas**
`src/types/schema.ts`

**Route handler**
`src/routes/audio.ts`

**Provider registry**
`src/providers/registry.ts`

**Test patterns**
`tests/routes/audio.test.ts` (EchoProvider / MinimalProvider)

**Available scripts**
`package.json` scripts: test, test:watch, typecheck, dev, lint, lint:fix

## Notes

- Pnpm, ESM, `.js` import extensions (NodeNext).
- Zod v4: `ZodError.issues` (not `.errors`).
- Express 5 catches async route rejections automatically.
