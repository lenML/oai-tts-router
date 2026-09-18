# Playground

React + Vite + Zustand + shadcn/ui 开发的 oai-tts-router 调试界面。

```bash
pnpm dev
pnpm build
pnpm lint
```

开发服务器默认运行在 `http://localhost:5173/playground/`，并将 `/v1` 代理到 `http://127.0.0.1:4567`。可通过 `VITE_PROXY_TARGET` 修改代理目标。
