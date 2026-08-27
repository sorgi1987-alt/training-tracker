import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  // Relative asset paths: `catalyst serve` serves the client under a local
  // /app/ prefix, while the deployed project serves it at the domain root.
  // Relative paths work under both without extra config.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Training Tracker',
        short_name: 'Training',
        description: 'Mobile-first training tracker',
        theme_color: '#111318',
        background_color: '#f5f6f8',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        // Asset caching only — active-workout offline persistence is a
        // separate, small IndexedDB store built in a later phase.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ],
  build: {
    outDir: 'dist'
  }
});
