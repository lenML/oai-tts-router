import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv } from 'vite'

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

function normalizeBasePath(path: string): string {
  const trimmed = path.trim()
  if (!trimmed || trimmed === '/') return '/'
  return `/${trimmed.replace(/^\/+|\/+$/g, '')}/`
}

function readConfigPort(): string | undefined {
  const configPath = fileURLToPath(new URL('../config.json', import.meta.url))
  if (!existsSync(configPath)) return undefined

  try {
    const parsed: unknown = JSON.parse(readFileSync(configPath, 'utf-8'))
    if (typeof parsed !== 'object' || parsed === null || !('port' in parsed)) return undefined
    const port = (parsed as { port?: unknown }).port
    return typeof port === 'number' || typeof port === 'string' ? String(port) : undefined
  } catch {
    return undefined
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, '')
  const apiPort = env['PORT'] || readConfigPort() || '3000'
  const proxyTarget = env['VITE_PROXY_TARGET'] || `http://127.0.0.1:${apiPort}`
  const basePath = normalizeBasePath(env['VITE_BASE_PATH'] || '/playground/')

  return {
    base: basePath,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      host: '0.0.0.0',
      port: Number(env['VITE_DEV_PORT'] || 5173),
      strictPort: true,
      proxy: {
        '/v1': {
          target: proxyTarget,
          changeOrigin: true,
        },
      },
    },
  }
})
