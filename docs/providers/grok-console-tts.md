# grok-console-tts

调用 x.ai Console Playground 的 TTS 接口，需要提供浏览器 SSO Cookie 才能使用。

## Cookie 获取方式

1. 打开 https://console.x.ai/playground/voice/text-to-speech
2. F12 → Network → 找到 /v1/tts 请求 → 复制请求 Cookie （有效期几天）
3. 配置到 config.json：

```json
"providers": { "grok-console-tts": { "cookies": ["sso=xxx; sso-rw=yyy;"] } }
```

支持配置多个 Cookie，每次请求随机选取，重试时自动切换。

## 支持的参数

| extra 参数  | 类型   | 默认值 | 说明                        |
| ----------- | ------ | ------ | --------------------------- |
| voice       | string | eve    | eve / ara / rex / sal / leo |
| codec       | string | mp3    | mp3 / pcm / ulaw / opus     |
| language    | string | en     | 语言代码                    |
| sample_rate | number | 24000  | 采样率 (Hz)                 |

## 运行时指定 Cookie

请求时通过 `cookie` 参数传入可不依赖系统配置（不触发重试和轮换）：

```json
{ "model": "grok-console-tts", "input": "Hello", "voice": "eve", "cookie": "sso=xxx; sso-rw=yyy" }
```
