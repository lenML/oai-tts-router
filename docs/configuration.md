# 配置

项目使用 **config.json** 作为主要配置文件，同时支持 .env 和环境变量覆盖。

## config.json

复制 `config.example.json` 为 `config.json` 然后编辑：

```json
{
  "port": 4567,
  "log_level": "info",
  "api_keys": ["sk-1234"],
  "proxy": {
    "http": "http://127.0.0.1:10808",
    "https": "http://127.0.0.1:10808"
  },
  "cache": { "tts_size": "100mb" },
  "providers": {
    "openai-fm": { "base_url": "https://www.openai.fm" }
  },
  "default_params": {
    "edge-tts": { "voice": "en-US-JennyNeural" }
  }
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `port` | number | `3000` | 监听端口 |
| `log_level` | string | `"info"` | debug / info / warn / error |
| `api_keys` | string\[\] | `[]` | 鉴权 key 列表，空=无鉴权 |
| `proxy.http` | string | - | 出站 HTTP 代理 |
| `proxy.https` | string | - | 出站 HTTPS 代理 |
| `cache.tts_size` | string | - | 响应缓存大小（如 `"100mb"`） |
| `providers` | object | `{}` | 各 Provider 特定配置 |
| `default_params` | object | `{}` | 每个模型的默认请求参数 |

## .env / 环境变量

环境变量优先级高于 config.json：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3000` | 监听端口 |
| `API_KEY` | - | 鉴权 key，逗号分隔 |
| `TTS_CACHE_SIZE` | `0` | 如 `100mb`，`0` 禁用 |
| `LOG_LEVEL` | `info` | 日志级别 |
| `HTTP_PROXY` | - | 出站 HTTP 代理 |
| `HTTPS_PROXY` | - | 出站 HTTPS 代理 |
| `CONFIG_PATH` | - | 自定义 config.json 路径 |

## 默认请求参数（default_params）

请求中未提供的字段会自动用默认值填充。请求中的值始终优先：

```json
{
  "default_params": {
    "edge-tts": { "voice": "en-US-JennyNeural", "rate": "+10%" }
  }
}
```
