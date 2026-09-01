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
      // Catalyst's static-file host maps content types by extension and
      // doesn't recognise `.webmanifest` (vite-plugin-pwa's default), so it
      // was serving the manifest as application/octet-stream — Chrome's
      // installability check can refuse to fire beforeinstallprompt over
      // that. `.json` is a universally-recognised extension every static
      // host maps correctly.
      manifestFilename: 'manifest.json',
      manifest: {
        // Explicit id — some Chrome versions use this (falling back to
        // start_url when absent) to identify "is this app already
        // installed", and leaving it implicit is one more thing that can
        // resolve inconsistently across a relative start_url/manifest URL.
        id: '/app/',
        name: 'Training Tracker',
        short_name: 'Training',
        description: 'Mobile-first training tracker',
        theme_color: '#111318',
        background_color: '#f5f6f8',
        display: 'standalone',
        // Fully-qualified from the origin root, not relative — relative
        // start_url/scope/icons ("." or "./icon.png") resolve against
        // whichever base URL a given browser version picks (the manifest's
        // own URL vs. the document's URL are BOTH valid readings of the old
        // spec text, and real browsers have disagreed on this historically).
        // This Catalyst project always serves the client under `/app/`
        // (confirmed via its deploy output and root-redirect behavior), so
        // hard-coding it removes that ambiguity entirely rather than
        // trusting every browser to resolve "." the same way.
        start_url: '/app/',
        scope: '/app/',
        icons: [
          { src: '/app/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/app/icon-512.png', sizes: '512x512', type: 'image/png' }
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
