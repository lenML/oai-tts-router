# edge-tts

调用微软 Edge TTS 服务，322+ 种声音，支持语速/音调/音量调节。

## 支持的参数

| extra 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| voice | string | - | 音色名，通过 `GET /v1/models` 获取 |
| rate | string | - | 语速，如 `+10%`、`-20%` |
| pitch | string | - | 音调，如 `+5Hz`、`-3Hz` |
| volume | string | - | 音量，如 `+20%`、`-10%` |
