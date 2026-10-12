import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'IshConnect LMS',
        short_name: 'IshConnect',
        description: 'Offline-first, book-based learning for Rwandan TVET and secondary education.',
        theme_color: '#695bbe',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/v1/cms'),
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'cms-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 } },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/v1/courses'),
            handler: 'NetworkFirst',
            options: { cacheName: 'courses-cache', networkTimeoutSeconds: 5, expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 } },
          },
          {
            urlPattern: ({ url }: { url: URL }) => url.pathname.startsWith('/api/v1/files'),
            handler: 'CacheFirst',
            options: { cacheName: 'files-cache', expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
  build: { sourcemap: true },
});
