<img width="1280" height="800" alt="playground screenshot" src="https://github.com/user-attachments/assets/273dfdb5-e5d3-48c6-a30b-be272b73e922" />

# oai-tts-router

a **Free** TTS Router — OpenAI TTS 兼容代理，聚合多种免费 TTS 后端。

## Features

- OpenAI TTS API 兼容
- 多种免费 TTS 后端聚合
- **长文本切割**：自动切分长文本，分段生成后拼接音频，突破单次字符限制
- **自动降级**：主模型失败时自动尝试备用模型，保证请求总有返回值
- 响应缓存（LRU）
- 可扩展 Provider 接口

详细 API 参数见 [API 文档](docs/api.md)。

## Quick Start

```bash
git clone https://github.com/lenML/oai-tts-router.git
cd oai-tts-router
cp config.example.json config.json
docker compose up -d
```

可用模型和对应 voices 通过 `GET /v1/models` 获取。详见各模型文档。

## Provider

| model              | 后端                          | 简介                                                                 | 文档                                        |
| ------------------ | ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------- |
| `google-translate` | Google Translate TTS          | 低质量，极速，无鉴权，IP敏感                                         | [docs](/docs/providers/google-translate.md) |
| `edge-tts`         | Edge TTS                      | 中质量，无鉴权，IP不敏感                                             | [docs](/docs/providers/edge-tts.md)         |
| `openai-fm-tts`    | OpenAI.fm                     | 中上质量，无鉴权，IP敏感，有限速                                     | [docs](/docs/providers/openai-fm.md)        |
| `grok-console-tts` | x.ai Console                  | 高质量，有鉴权，IP敏感，速度很快，应该有限速但是额度很高             | [docs](/docs/providers/grok-console-tts.md) |
| `gemini-tts`       | Google Cloud TTS (Gemini-TTS) | 超高质量，有鉴权，IP敏感，速度一般，限制文本长度，有限速，有超时中断 | [docs](/docs/providers/gemini-tts.md)       |

## Config

配置以 `config.json` 为主，不推荐使用 `.env` 文件。若使用 Docker 部署，建议在 `docker compose` 的 `environment` 中设置环境变量，而非依赖 `.env` 文件。

详见 [配置文档](docs/configuration.md)。

## API

完整的 API 参数说明（包括长文本切割、自动降级、缓存控制等）见 [API 文档](docs/api.md)。

## Playground

启动之后看 [`http://localhost:17777/playground/`](http://localhost:17777/playground/) (端口换成你配置的)

鉴权：如果配置了 apikey ，开启 playground 会弹窗用户名密码，其中用户名随便填，密码填 apikey

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