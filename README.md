<img width="1280" height="800" alt="playground screenshot" src="https://github.com/user-attachments/assets/273dfdb5-e5d3-48c6-a30b-be272b73e922" />

# oai-tts-router

a **Free** TTS Router — OpenAI TTS 兼容代理，聚合多种免费 TTS 后端。

## Quick Start

```bash
git clone https://github.com/lenML/oai-tts-router.git
cd oai-tts-router
cp config.example.json config.json
docker compose up -d
```

可用模型和对应 voices 通过 `GET /v1/models` 获取。详见各模型文档。

## Provider

| model | 后端 | 文档 |
| --- | --- | --- |
| `google-translate` | Google Translate TTS | [docs](/docs/providers/google-translate.md) |
| `edge-tts` | Edge TTS | [docs](/docs/providers/edge-tts.md) |
| `openai-fm-tts` | OpenAI.fm | [docs](/docs/providers/openai-fm.md) |
| `grok-console-tts` | x.ai Console | [docs](/docs/providers/grok-console-tts.md) |
| `gemini-tts` | Google Cloud TTS (Gemini-TTS) | [docs](/docs/providers/gemini-tts.md) |

## Config

详见 [配置文档](/docs/configuration.md)。

## Playground

路径 `/playground/`。

## Dev

```bash
pnpm install
pnpm dev
pnpm build
pnpm start
```

### Docker Dev

```bash
docker compose --profile dev up -d
```
