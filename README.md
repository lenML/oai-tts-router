<!-- TODO: 放一张 Playground 截图 -->

# oai-tts-router

OpenAI TTS API 兼容的路由/代理，将 `/v1/audio/speech` 请求转发到不同的免费 TTS 提供商。

## 使用

直接用 `openai` 库，改个 `baseURL` 就行：

```ts
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-api-key',
  baseURL: 'http://localhost:17777/v1', // 换成你的地址
});

const response = await client.audio.speech.create({
  model: 'google-translate',
  input: 'Hello, world!',
  voice: 'en',
});

const buffer = Buffer.from(await response.arrayBuffer());
```

可用模型和对应 voices 通过 `GET /v1/models` 获取。

```bash
# 列出所有模型及其支持的 voice
curl http://localhost:17777/v1/models -H "Authorization: Bearer sk-your-api-key"
```

## 特点

- 不需要 GPU/CUDA，纯 Node.js
- 内置多个免费 TTS 提供商
- 完全兼容 OpenAI TTS API 格式
- 实现 `TtsProvider` 接口即可接入自定义 TTS 引擎

## 快速开始

```bash
docker compose up -d
# 访问 http://localhost:17777/playground/
```

开发模式（热重载）：

```bash
docker compose --profile dev up -d
```

## 内置模型

| model              | 后端                 | 说明                                                             |
| ------------------ | -------------------- | ---------------------------------------------------------------- |
| `google-translate` | Google Translate TTS | 极速生成，自动识别语言，可用 extra 参数指定语音，没有 voice 切换 |
| `edge-tts`         | Edge TTS             | 320+ 种声音，支持 `rate`/`pitch`/`volume` 参数                   |
| `openai-fm-tts`    | OpenAI.fm            | 与 OpenAI TTS API 相同的 11 种声音                               |

每个模型支持的 `voice` 通过 `GET /v1/models` 获取。

## 鉴权

设置 `API_KEY` 环境变量：

```
API_KEY=sk-my-secret-key,sk-another-key
```

- API 请求：`Authorization: Bearer <key>`
- Playground：HTTP Basic Auth，密码填任意一个 key （用户名忽略）
- 不设 `API_KEY`：完全开放

## 配置

| 变量             | 默认值 | 说明                           |
| ---------------- | ------ | ------------------------------ |
| `PORT`           | `3000` | 监听端口                       |
| `API_KEY`        | -      | 鉴权 key，逗号分隔             |
| `TTS_CACHE_SIZE` | `0`    | 缓存大小，如 `100mb`，`0` 禁用 |
| `HTTP_PROXY`     | -      | 出站 HTTP 代理                 |
| `HTTPS_PROXY`    | -      | 出站 HTTPS 代理                |

## Playground

内置网页调试工具，路径 `/playground/`。可切换模型、声音、语速、输出格式，实时试听。页面受 Basic Auth 保护。

## 本地开发

```bash
pnpm install
pnpm dev      # 热重载
pnpm build
pnpm start
```
