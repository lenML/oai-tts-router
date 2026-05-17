# API 文档

## POST /v1/audio/speech

兼容 OpenAI TTS API。所有 OpenAI 标准参数均受支持，同时扩展了额外功能。

### 请求体

请求体为 JSON，所有参数说明如下：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `model` | string | 是 | - | 模型 ID，通过 `GET /v1/models` 获取可用列表 |
| `input` | string | 是 | - | 要合成的文本，最长 4096 字符；启用 `text_split` 时最长 100000 字符 |
| `voice` | string | 取决于 provider | - | 发音人 ID，通过 `GET /v1/models/{model}` 获取可用列表 |
| `response_format` | string | 否 | `"mp3"` | 输出音频格式：`mp3`, `opus`, `aac`, `flac`, `wav`, `pcm`（取决于 provider 支持） |
| `speed` | number | 否 | `1.0` | 语速，0.25–4.0（取决于 provider 支持） |
| `instructions` | string | 否 | - | 发音指令/风格提示（取决于 provider 支持） |
| `no_cache` | boolean | 否 | `false` | 设为 `true` 时跳过缓存，强制调用 TTS 后端 |
| `text_split` | boolean | 否 | `false` | 启用长文本切割。文本超过 `text_split_max_length` 时自动切分，分段生成后拼接音频 |
| `text_split_max_length` | number | 否 | `1000` | 每段最大字符数，范围 1–10000。仅当 `text_split: true` 时生效 |
| `fallback_models` | string[] | 否 | - | 主模型失败时的降级模型列表。按序尝试，跳过重复模型 |

### 响应

成功时返回 200，Content-Type 为对应音频格式的 MIME 类型，body 为二进制音频数据。

失败时返回 JSON 格式的 OpenAI 风格错误：

```json
{
  "error": {
    "message": "错误描述",
    "type": "invalid_request_error | provider_error | server_error",
    "param": null,
    "code": "model_not_found | voice_not_supported | provider_unavailable"
  }
}
```

### 示例

**基础请求**

```bash
curl -X POST http://localhost:3000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "openai-fm-tts",
    "input": "你好世界",
    "voice": "alloy"
  }' \
  -o output.mp3
```

**长文本切割**

```bash
curl -X POST http://localhost:3000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-tts",
    "input": "（此处为一篇长文，超过 1000 字）",
    "voice": "en-US-JennyNeural",
    "text_split": true,
    "text_split_max_length": 500
  }' \
  -o output.wav
```

**自动路由降级**

```bash
curl -X POST http://localhost:3000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemini-tts",
    "input": "你好世界",
    "voice": "en-US-Standard-D",
    "fallback_models": ["openai-fm-tts", "edge-tts"]
  }' \
  -o output.mp3
```

**组合使用**

```bash
curl -X POST http://localhost:3000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "grok-console-tts",
    "input": "（长文本内容）",
    "voice": "coral",
    "text_split": true,
    "fallback_models": ["openai-fm-tts", "edge-tts"]
  }' \
  -o output.wav
```

**跳过缓存**

```bash
curl -X POST http://localhost:3000/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "model": "edge-tts",
    "input": "Hello world",
    "voice": "en-US-JennyNeural",
    "no_cache": true
  }' \
  -o output.mp3
```

## GET /v1/models

返回所有可用模型列表及元信息。

### 响应

```json
{
  "object": "list",
  "data": [
    {
      "id": "openai-fm-tts",
      "object": "model",
      "created": 1715000000,
      "owned_by": "openai-fm",
      "supported_voices": ["alloy", "ash", ...]
    }
  ]
}
```

## GET /v1/models/{model}

返回指定模型的详细信息。

### 响应

```json
{
  "id": "openai-fm-tts",
  "object": "model",
  "created": 1715000000,
  "owned_by": "openai-fm",
  "supported_voices": ["alloy", "ash", ...]
}
```

## 功能说明

### 长文本切割（text_split）

当文本超过 `text_split_max_length` 时，系统自动按以下优先级切分：

1. **句边界**：句号（。！？.!?\n）处切分
2. **词边界**：空格、逗号、分号等标点处切分
3. **硬切分**：无可用的边界时在最大长度处截断

切割后的每个文本段分别调用 TTS 后端生成音频，然后拼接为完整音频返回。

**拼接格式支持**：仅 WAV 和 MP3。其他格式的响应拼接会返回错误。

**注意**：不同语言（中文、英文、日文、韩文等）的句边界和词边界均被识别。

### 自动路由降级（fallback_models）

开启后，如果主模型调用失败（网络错误、超时、HTTP 429/5xx 等），系统会自动按 `fallback_models` 列表依次尝试备用模型：

- 跳过已在列表中重复的模型 ID
- 跳过系统中未注册的模型 ID（记录警告日志）
- 任一模型成功后立即返回音频，不再继续尝试
- 全部失败则返回 502 provider_error

**应用场景**：TTS 服务不稳定时保证请求总能有返回值。