import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// 社区 SPA 构建到 ../web/app，首页（../web/index.html）保持原生静态。
// base 固定 /app/，产物资源走 /app/assets/*，由 Node 后端托管。
export default defineConfig({
  base: '/app/',
  plugins: [svelte()],
  build: {
    outDir: '../web/app',
    emptyOutDir: true,
    target: 'es2022',
    assetsInlineLimit: 2048,
  },
  server: {
    port: 5173,
    proxy: { '/api': 'http://127.0.0.1:8080', '/mirror-api': 'http://127.0.0.1:8080' },
  },
})