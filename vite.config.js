import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '5.0.0'),
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon-192.png', 'icon-512.png', 'icon-512-maskable.png', 'apple-touch-icon.png', 'favicon.png', 'logo-tic.png'],
      manifest: {
        name: 'Tech in Cash — Logiciel de caisse',
        short_name: 'Tech in Cash',
        description: 'Logiciel de caisse textile multi-magasin',
        start_url: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F8F7F4',
        theme_color: '#0F172A',
        categories: ['business', 'finance'],
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            // Cache API calls — ONLY same-origin (avoid intercepting external API on Capacitor)
            urlPattern: ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
              networkTimeoutSeconds: 10,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // Cache fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
  // Bibliotheques dans des fichiers a part : elles changent rarement, la caisse les garde en
  // cache et ne retelecharge que le code de l'application a chaque mise a jour. Et le fichier
  // principal reste loin de la limite de 2 Mo du cache hors-ligne (Workbox) : au-dela, il
  // n'etait plus mis en cache et la caisse ne demarrait plus sans reseau, sans aucun message.
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/.test(id)) return 'vendor-react';
          if (/[\\/]node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor|internmap|decimal\.js-light|eventemitter3|lodash|react-smooth|recharts-scale|tiny-invariant|fast-equals|clsx|react-is|prop-types)[\\/]/.test(id)) return 'vendor-charts';
          if (/[\\/]node_modules[\\/](papaparse|jszip)[\\/]/.test(id)) return 'vendor-fichiers';
          if (/[\\/]node_modules[\\/]lucide-react[\\/]/.test(id)) return 'vendor-icones';
          return 'vendor';
        },
      },
    },
  },
});
