import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  server: {
    host: true,
  },
  build: {
    // 主程式約 530KB（React 19.3 的 react-dom 比 19.2 大約 27KB）。
    // 這是離線 PWA，所有檔案第一次開啟就會整包快取，拆檔不會減少下載量，所以把警告門檻調到 600KB。
    chunkSizeWarningLimit: 600,
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'utakasse-logo.png'],
      manifest: {
        name: '姬帳 UtaKasse',
        short_name: 'UtaKasse',
        description: '同人場記帳 App',
        theme_color: '#FF9F1C',
        background_color: '#CBF3F0',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        // xlsx（SheetJS）chunk 約 500KB，要進 precache 才能離線匯出；預設上限 2MB，這裡放寬到 4MB 以防未來增大
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
            }
          }
        ]
      }
    })
  ]
})
