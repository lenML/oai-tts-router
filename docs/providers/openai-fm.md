# openai-fm-tts

调用 OpenAI.fm 的 TTS 接口，与 OpenAI TTS API 相同的 11 种声音。

## 配置

```json
"providers": { "openai-fm": { "base_url": "https://www.openai.fm" } }
```

## 支持的参数

| extra 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| voice | string | - | alloy / ash / ballad / coral / echo / fable / nova / onyx / sage / shimmer / verse |
| response_format | string | mp3 | mp3 / opus / aac / flac / wav / pcm |
| speed | number | 1.0 | 语速 [0.25 - 4.0] |
