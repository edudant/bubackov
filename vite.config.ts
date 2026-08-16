import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/bubackov/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Bubackov — rodinná kronika',
        short_name: 'Bubackov',
        description: 'Soukromá, šifrovaná kronika rodinných cest a vzpomínek.',
        theme_color: '#17130f',
        background_color: '#17130f',
        display: 'standalone',
        orientation: 'any',
        start_url: '/bubackov/',
        scope: '/bubackov/',
        icons: [
          {
            src: '/bubackov/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff2,json}'],
        globIgnores: ['archive/**/*'],
        runtimeCaching: [
          {
            urlPattern: /\/bubackov\/archive\/.*\.(?:bin|json)$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'encrypted-archive',
              expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ]
});
