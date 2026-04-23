// @ts-check
import { defineConfig } from 'astro/config';

import vercel from '@astrojs/vercel/serverless';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import AstroPWA from '@vite-pwa/astro';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [
    react(),
    AstroPWA({
      registerType: 'autoUpdate',
      // 🟢 Aquí está el bloque workbox correctamente ADENTRO del plugin PWA
      workbox: {
        navigateFallback: '/',
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}']
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
    plugins: [tailwindcss()]
  }
});
