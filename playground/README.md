# Playground

React + Vite + Zustand + shadcn/ui 开发的 oai-tts-router 调试界面。

```bash
pnpm dev
pnpm build
pnpm lint
```

开发服务器默认运行在 `http://localhost:5173/playground/`，并将 `/v1` 代理到后端实际端口。可通过 `VITE_PROXY_TARGET` 修改代理目标。

功能包括中英日韩 i18n、URL 语言同步、IndexedDB 历史持久化和可配置历史上限。
