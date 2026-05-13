# OpenAI TTS API 接口规范

## 概述

OpenAI 提供 Text-to-Speech (TTS) API，将文本转换为自然 sounding 的语音音频。
本服务兼容该接口规范，允许用户以 OpenAI API 兼容的方式调用后端 TTS 能力。

## 基本信息

| 项目     | 值                                       |
| -------- | ---------------------------------------- |
| 端点     | `POST /v1/audio/speech`                  |
| 完整 URL | `https://api.openai.com/v1/audio/speech` |
| 请求格式 | `application/json`                       |
| 响应格式 | 二进制音频数据                           |
| 认证方式 | `Authorization: Bearer <token>`          |

## 请求参数

### Request Body (JSON)

| 参数              | 类型     | 必填 | 默认值 | 说明                                                   |
| ----------------- | -------- | ---- | ------ | ------------------------------------------------------ |
| `model`           | `string` | 是   | -      | TTS 模型 ID，如 `tts-1`、`tts-1-hd`、`gpt-4o-mini-tts` |
| `input`           | `string` | 是   | -      | 要合成的文本，最大长度 4096 字符                       |
| `voice`           | `string` | 是   | -      | 发音人，可选值见下方列表                               |
| `response_format` | `string` | 否   | `mp3`  | 音频输出格式                                           |
| `speed`           | `number` | 否   | `1.0`  | 语速倍率，范围 0.25 ~ 4.0                              |

### voice 可选值

| 值        | 说明           |
| --------- | -------------- |
| `alloy`   | 中性声音       |
| `echo`    | 深沉、有共鸣   |
| `fable`   | 轻快、叙述风格 |
| `onyx`    | 稳重、权威     |
| `nova`    | 温暖、女性     |
| `shimmer` | 明亮、女性     |
| `ash`     | 中性、年轻     |
| `ballad`  | 柔和叙事       |
| `coral`   | 温暖生动       |
| `sage`    | 中性平静       |
| `verse`   | 叙事风格       |
| `marin`   | 高品质中性     |
| `cedar`   | 高品质深沉     |

### response_format 可选值

| 值     | 说明                       | Content-Type                        |
| ------ | -------------------------- | ----------------------------------- |
| `mp3`  | MP3 格式                   | `audio/mpeg`                        |
| `opus` | Opus 编码的 OGG 格式       | `audio/ogg; codecs=opus`            |
| `aac`  | AAC 格式                   | `audio/aac`                         |
| `flac` | FLAC 无损格式              | `audio/flac`                        |
| `wav`  | WAV 格式                   | `audio/wav`                         |
| `pcm`  | 16-bit PCM (24kHz, 单声道) | `audio/L16; rate=24000; channels=1` |

## 请求示例

```http
POST /v1/audio/speech
Authorization: Bearer sk-xxx
Content-Type: application/json

{
  "model": "tts-1",
  "input": "Hello, this is a test of text to speech.",
  "voice": "alloy",
  "response_format": "mp3",
  "speed": 1.0
}
```

## 响应

### 成功响应 (200 OK)

- Content-Type 根据 `response_format` 参数决定（见上表）
- Body 为原始二进制音频数据

### 错误响应

遵循 OpenAI 标准错误格式：

```json
{
  "error": {
    "message": "描述错误的详细信息",
    "type": "错误类型",
    "param": "导致错误的参数名，若无则为 null",
    "code": "错误码，若无则为 null"
  }
}
```

#### 常见 HTTP 状态码

| 状态码 | 说明                                         |
| ------ | -------------------------------------------- |
| 400    | 请求参数错误（缺少必填字段、参数值不合法等） |
| 401    | 认证失败（API key 无效）                     |
| 429    | 请求频率超限                                 |
| 500    | 服务内部错误                                 |
| 502    | TTS 后端服务不可用                           |

### 常见错误类型

| type                    | code                   | 说明             |
| ----------------------- | ---------------------- | ---------------- |
| `invalid_request_error` | -                      | 请求参数验证失败 |
| `authentication_error`  | -                      | API key 无效     |
| `rate_limit_error`      | -                      | 速率限制         |
| `server_error`          | -                      | 服务端内部错误   |
| `provider_error`        | `provider_unavailable` | TTS 后端不可用   |

## 客户端使用示例

### Node.js (OpenAI SDK)

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-xxx',
  baseURL: 'http://localhost:3000/v1',
});

const response = await client.audio.speech.create({
  model: 'tts-1',
  input: 'Hello, world!',
  voice: 'alloy',
  response_format: 'mp3',
  speed: 1.0,
});

const buffer = Buffer.from(await response.arrayBuffer());
await fs.writeFile('speech.mp3', buffer);
```

### cURL

```bash
curl http://localhost:3000/v1/audio/speech \
  -H "Authorization: Bearer sk-xxx" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "tts-1",
    "input": "Hello, world!",
    "voice": "alloy",
    "response_format": "mp3",
    "speed": 1.0
  }' \
  --output speech.mp3
```

## 与本服务的差异说明

本服务作为 OpenAI TTS 兼容层，旨在接入第三方免费/开源 TTS 服务，因此与官方 API 存在以下差异：

1.  **认证方式可配置**：可由管理员决定是否需要 API key 验证。
2.  **model 参数路由**：自定义模型名称到具体 TTS Provider 的映射。
3.  **voice 映射**：不同 Provider 支持的发音人不同，实际映射取决于 Provider 实现。
4.  **支持的格式**：最终支持的音频格式取决于后端 Provider 的能力。
