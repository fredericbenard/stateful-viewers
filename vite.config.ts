import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(() => {
  const devApiTarget = 'http://localhost:8787'

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Keep local Ollama working in dev without involving Node.
        '/api/ollama': {
          target: 'http://localhost:11434',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/ollama/, ''),
        },
        // Everything else under /api is implemented by the Node server (single source of truth).
        '/api': {
          target: devApiTarget,
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              // Avoid tripping the Node server's CORS checks (requests are server-to-server in dev).
              proxyReq.removeHeader('origin')
            })
          },
        },
        '/images': {
          target: 'https://www.fredericbenard.com',
          changeOrigin: true,
        },
      },
    },
  }
})
