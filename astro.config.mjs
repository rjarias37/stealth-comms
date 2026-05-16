// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
  output: 'static', // 🛡️ El nuevo estándar para arquitectura híbrida en Astro 6
  adapter: vercel(), // 🛡️ functionPerRoute ya no es necesario, es automático
  integrations: [
    react(),
    AstroPWA({
      registerType: 'autoUpdate',
      workbox: {
        navigateFallback: '/',
        // Los chunks vendor-* son estables entre deploys — se cachean agresivamente.
        // vendor-livekit se excluye del precache del SW porque supera el límite
        // de tamaño de workbox y se carga bajo demanda (lazy) por el navegador.
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}'],
        globIgnores: ['**/vendor-livekit*.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024, // 3 MB — elimina warnings de PWA
      },
      manifest: {
        name: 'Stealth Comms',
        short_name: 'Stealth Comms',
        description: 'El Tren de Algarve',
        theme_color: '#0a1128',
        background_color: '#0a1128',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/logo-tren.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/logo-tren.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/logo-tren.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  vite: {
    plugins: [tailwindcss()],
    build: {
      emptyOutDir: false, // 🛡️ Protege los binarios durante la compilación en Vercel

      // Eleva el límite de advertencia a 750 kB.
      // livekit-client supera los 500 kB por diseño (WebRTC + E2EE + WebSocket).
      // Con manualChunks los chunks individuales quedan por debajo de este umbral.
      chunkSizeWarningLimit: 750,

      rollupOptions: {
        output: {
          manualChunks(id) {
            // ── vendor-react ──────────────────────────────────────────────
            // React core: estable entre deploys → caché agresiva del navegador.
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/scheduler/')
            ) {
              return 'vendor-react';
            }

            // ── vendor-livekit ────────────────────────────────────────────
            // livekit-client (~800 kB) + @livekit/components-react (~150 kB).
            // Son co-dependientes: siempre se cargan juntos → mismo chunk.
            // Excluido del precache del Service Worker (ver globIgnores en PWA).
            if (
              id.includes('node_modules/livekit-client/') ||
              id.includes('node_modules/@livekit/')
            ) {
              return 'vendor-livekit';
            }

            // ── vendor-icons ──────────────────────────────────────────────
            // lucide-react tiene tree-shaking, pero agrupar el módulo base
            // evita micro-fragmentación en el grafo de módulos.
            if (id.includes('node_modules/lucide-react/')) {
              return 'vendor-icons';
            }
          },
        },
      },
    },
  }
});