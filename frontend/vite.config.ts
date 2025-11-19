import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  define: {
    // Inject compile-time boolean constant for tree-shaking
    // When BUILD_TARGET=prod, this becomes literal `false` and dead code is eliminated
    '__VITE_IS_DEMO_BUILD__': JSON.stringify((process.env.BUILD_TARGET || 'prod') === 'rc'),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'apple-touch-icon.png'],
      devOptions: {
        enabled: true, // Enable PWA in dev mode for testing
        type: 'module',
      },
      manifest: {
        name: 'M3W Music Player',
        short_name: 'M3W',
        description: 'Self-hosted music player with offline support',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
          // Cache API GET requests with NetworkFirst strategy
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/') &&
              (url.pathname.includes('/songs') ||
                url.pathname.includes('/libraries') ||
                url.pathname.includes('/playlists')),
            handler: 'NetworkFirst',
            method: 'GET',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 60 * 60 * 24, // 24 hours
              },
              networkTimeoutSeconds: 10,
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          // Cache audio files with CacheFirst strategy
          {
            urlPattern: ({ url }) => url.pathname.match(/^\/api\/songs\/\d+\/stream/),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              rangeRequests: true, // Support Range requests for audio
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Radix UI components
          'ui-vendor': [
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-avatar',
            '@radix-ui/react-dialog',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-toast',
          ],
          // PWA and offline support
          'pwa-vendor': [
            'workbox-core',
            'workbox-precaching',
            'workbox-routing',
            'workbox-strategies',
            'dexie',
            'dexie-react-hooks',
          ],
          // Audio and utilities
          'utils-vendor': ['howler', 'zustand', 'clsx', 'tailwind-merge'],
        },
      },
    },
    // Increase chunk size warning limit to 600KB (still reasonable with code splitting)
    chunkSizeWarningLimit: 600,
  },
  server: {
    host: '0.0.0.0', // Listen on all network interfaces
    port: 3000,
    open: true,
  },
  preview: {
    port: 3000,
    strictPort: true, // Fail if port is in use instead of trying another
  },
});
