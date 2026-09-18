# elevenlabs

调用 ElevenLabs Text-to-Speech API。默认使用 `POST /v1/text-to-speech/{voice_id}`，支持请求级 API key、key 轮换、标准输出格式和 ElevenLabs voice settings。

## 配置

推荐通过环境变量提供 key：

```env
ELEVENLABS_API_KEY=sk_xxx
```

多个 key 可用逗号分隔：

```env
ELEVENLABS_API_KEY=sk_key1,sk_key2
```

也可在 `config.json` 配置：

```json
"providers": {
  "elevenlabs": {
    "keys": ["sk_key1", "sk_key2"]
  }
}
```

## 请求级 Key

`keys` 优先于全局配置。遇到 `401`、`403` 或 `429` 时会切换 key 重试：

```json
{
  "model": "elevenlabs",
  "input": "Hello from ElevenLabs.",
  "voice_id": "JBFqnCBsd6RMkjVDRZzb",
  "model_id": "eleven_multilingual_v2",
  "keys": ["sk_user_key_1", "sk_user_key_2"]
}
```

也支持单个 key：

```json
{
  "model": "elevenlabs",
  "input": "Hello",
  "api_key": "sk_user_key"
}
```

## 模型

`model` 可直接传 ElevenLabs model ID，例如：

- `elevenlabs`：使用 `model_id` 或默认 `eleven_multilingual_v2`
- `eleven_v3`
- `eleven_multilingual_v2`
- `eleven_flash_v2_5`
- `eleven_turbo_v2_5`

## 参数

| 参数                                        | 类型     | 默认值                   | 说明                                                             |
| ------------------------------------------- | -------- | ------------------------ | ---------------------------------------------------------------- |
| `voice_id` / `voice`                        | string   | `21m00Tcm4TlvDq8ikWAM`   | ElevenLabs voice ID                                              |
| `model_id`                                  | string   | `eleven_multilingual_v2` | 覆盖请求 model ID                                                |
| `output_format`                             | string   | `mp3_44100_128`          | ElevenLabs 原生输出格式                                          |
| `response_format`                           | string   | -                        | API 风格映射：mp3 / wav / pcm / opus / ulaw / alaw               |
| `language_code`                             | string   | -                        | ISO 639-1 语言代码                                               |
| `enable_logging`                            | boolean  | `true`                   | ElevenLabs 历史记录开关                                          |
| `optimize_streaming_latency`                | number   | -                        | 0–4，已弃用的延迟优化参数                                        |
| `voice_settings`                            | object   | -                        | stability / similarity_boost / style / speed / use_speaker_boost |
| `stability`                                 | number   | -                        | `voice_settings.stability` 顶层简写                              |
| `similarity_boost`                          | number   | -                        | `voice_settings.similarity_boost` 顶层简写                       |
| `style`                                     | number   | -                        | `voice_settings.style` 顶层简写                                  |
| `speed`                                     | number   | -                        | `voice_settings.speed` 顶层简写                                  |
| `use_speaker_boost`                         | boolean  | -                        | `voice_settings.use_speaker_boost` 顶层简写                      |
| `seed`                                      | number   | -                        | 0–4294967295                                                     |
| `previous_text` / `next_text`               | string   | -                        | 分段生成上下文                                                   |
| `previous_request_ids` / `next_request_ids` | string[] | -                        | 最多 3 个请求 ID                                                 |
| `apply_text_normalization`                  | string   | `auto`                   | auto / on / off                                                  |
| `apply_language_text_normalization`         | boolean  | `false`                  | 语言文本规范化                                                   |
| `pronunciation_dictionary_locators`         | object[] | -                        | 最多 3 个发音词典 locator                                        |

Key 只用于 `xi-api-key` 请求头，不写入日志。缓存键只保存 key 的 SHA-256 摘要。
