<img width="1280" height="800" alt="image (1)" src="https://github.com/user-attachments/assets/29f4c71d-0863-4bfa-aad3-e32c09e2e75c" />

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

## 公开 Endpoint

目前暂无公开 endpoint，列表等待添加。公开服务可能限流、失效或下线，不建议提交敏感内容；如需稳定使用，请自行部署。

| 名称   | Base URL | 维护者 | 状态     | 备注             |
| ------ | -------- | ------ | -------- | ---------------- |
| _暂无_ | -        | -      | 等待添加 | 欢迎提交 PR 添加 |

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

- 支持中、英、日、韩四种语言，自动识别浏览器语言，也可在界面切换。语言会写入 URL，如 `?lang=zh`。
- 生成历史保存在浏览器 IndexedDB，默认最多 30 条，可在设置中调整。

### 使用托管 Playground

本地部署完成后，可以直接打开 [oai-tts-router Playground](https://lenml.github.io/oai-tts-router/) 测试和使用。打开设置，将 `Base URL` 填为你的服务地址：同机服务可使用 `http://localhost:17777/v1`，远程服务请填写公开 HTTPS 地址。

GitHub Pages 只托管静态前端，实际语音请求会直接从浏览器发送到你填写的 endpoint。后端需允许该 Origin，例如在 `config.json` 中配置：

```json
{
  "cors": {
    "origin": ["https://lenml.github.io", "http://localhost:5173"]
  }
}
```

也可设置环境变量 `CORS_ORIGIN=https://lenml.github.io,http://localhost:5173`。默认值为 `["*"]`，允许全部 Origin。

### 部署自己的 Playground

仓库包含 `.github/workflows/deploy-playground.yml`，推送到 `main` 后会自动构建并部署 `playground/`。

在 GitHub 仓库的 `Settings -> Pages` 中将 Source 设为 `GitHub Actions`。可选添加 Repository Variables：

- `VITE_API_BASE_URL`: 公开的 TTS Router 地址，例如 `https://tts.example.com/v1`
- `VITE_BASE_PATH`: 自定义域名部署在根路径时设为 `/`

未配置 `VITE_API_BASE_URL` 时，打开 Playground 后在 Settings 中手动填写 Base URL。后端已启用 CORS。

鉴权：如果配置了 apikey ，开启 playground 会弹窗用户名密码，其中用户名随便填，密码填 apikey

## Dev

```bash
pnpm install
pnpm dev
```

`pnpm dev` starts the API and Vite Playground together:

- API: `http://localhost:4567` or the configured `port`
- Playground: `http://localhost:5173/playground/`

Vite reads `PORT` and `config.json.port` automatically for its `/v1` proxy. Set `VITE_PROXY_TARGET` to override the target. `VITE_DEV_PORT` changes the Vite port.

Use `pnpm dev:server` or `pnpm dev:playground` to run either process alone.

Production build:

```bash
pnpm build
pnpm start
```

### Docker Dev

```bash
docker compose --profile dev up -d
```
