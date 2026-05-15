# gemini-tts

调用 Google Cloud TTS (Gemini-TTS) API，通过 `cxl-services.appspot.com` 代理访问。需要提供 reCAPTCHA token 才能使用。

## Token 获取方式

1. 打开 https://www.gstatic.com/cloud-site-ux/text_to_speech/text_to_speech.min.html
2. F12 → Network → 点击 Listen → 复制 `&token=` 值（有效期约 2 分钟）
3. 配置到 config.json：

```json
"providers": {
  "gemini-tts": {
    "tokens": ["your-recaptcha-token-here"]
  }
}
```

支持配置多个 token，每次请求随机选取一个，重试时自动切换到另一个。

## 可用模型

| extra model 值 | 说明 |
| --- | --- |
| gemini-2.5-flash-tts (默认) | 低延迟，单/多说话者 |
| gemini-2.5-pro-tts | 高度控制，播客/有声书 |
| gemini-2.5-flash-lite-preview-tts | 轻量预览版 |

## 支持的编码格式

| encoding 值 | 说明 |
| --- | --- |
| LINEAR16 (默认) | PCM s16le |
| MP3 | MP3 32kbps |
| MP3_64_KBPS | MP3 64kbps |
| OGG_OPUS | Opus Ogg 容器 |
| MULAW | μ-law 8bit |
| ALAW | A-law 8bit |
| PCM | PCM 16bit 裸流 |

## 支持的参数

| extra 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| voice | string | Kore | 音色名（支持任意值） |
| model | string | gemini-2.5-flash-tts | 模型名 |
| language | string | en-us | BCP-47 语言代码 |
| gender | string | - | MALE / FEMALE / NEUTRAL |
| encoding | string | LINEAR16 | 音频编码格式 |
| sample_rate | number | 24000 | 采样率 (Hz) |
| speed | number | - | 语速 [0.25 - 2.0] |
| pitch | number | - | 音调 [-20.0 - 20.0] 半音 |
| gain | number | - | 音量增益 [-96.0 - 16.0] dB |
| prompt | string | - | 语音风格提示（max 4000 bytes） |

## 默认音色

Achernar, Achird, Algenib, Algieba, Alnilam, Aoede, Autonoe, Callirrhoe, Charon, Despina, Enceladus, Erinome, Fenrir, Gacrux, Iapetus, **Kore**, Laomedeia, Leda, Orus, Pulcherrima, Puck, Rasalgethi, Sadachbia, Sadaltager, Schedar, Sulafat, Umbriel, Vindemiatrix, Zephyr, Zubenelgenubi

更多音色参考 [Google Cloud TTS 官方文档](https://docs.cloud.google.com/text-to-speech/docs/gemini-tts?hl=zh-cn#voice_options)。

## 运行时指定 Token

如果不想在 config.json 中配置全局 token，也可以在每次请求时通过 `token` 参数传入：

```json
{"model": "gemini-tts", "input": "Hello", "voice": "Kore", "token": "your-recaptcha-token"}
```

使用 `token` 参数时不使用系统配置，不触发重试和 token 轮换。
