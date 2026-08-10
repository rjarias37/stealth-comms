// RUTA EXACTA DEL ARCHIVO: astro.config.mjs
import path from 'path';
import { fileURLToPath } from 'url';

import { defineConfig } from 'astro/config';

import sitemap from '@astrojs/sitemap';
import partytown from '@astrojs/partytown';
import react from '@astrojs/react';
import icon from 'astro-icon';
import compress from 'astro-compress';
import vercel from '@astrojs/vercel';
import AstroPWA from '@vite-pwa/astro';
import tailwindcss from '@tailwindcss/vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const hasExternalScripts = false;
const whenExternalScripts = (items = []) =>
  hasExternalScripts ? (Array.isArray(items) ? items.map((item) => item()) : [items()]) : [];

export default defineConfig({
  // 🟢 FORZAMOS MODO SSR: Requerido para procesar dinámicamente los tokens de LiveKit
  output: 'server',
  adapter: vercel(),

  integrations: [
    react(),
    sitemap(),
    icon({
      include: {
        tabler: ['*'],
        'flat-color-icons': [
          'template',
          'gallery',
          'approval',
          'document',
          'advertising',
          'currency-exchange',
          'voice-presentation',
          'business-contact',
          'database',
        ],
      },
    }),

    // 🟢 INYECCIÓN DEL MÓDULO PWA DE ALTO RENDIMIENTO (CON PROBADA RESISTENCIA ANTE PETICIONES 429)
    AstroPWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      workbox: {
        // Cortamos el bucle estático: evita el fallo de 'non-precached-url' en SSR
        navigateFallback: null,
        // Lista negra para el Service Worker: prohibido interceptar API de tokens y la central de LiveKit
        navigateFallbackDenylist: [/^\/api\/.*$/, /^\/rtc\/.*$/],
        globPatterns: ['**/*.{css,js,html,svg,png,ico,txt}']
      },
      manifest: {
        name: 'ZPing',
        short_name: 'ZPing',
        description: 'Zero-lag voice for your squad',
        theme_color: '#0A0B0F',
        background_color: '#0A0B0F',
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

    ...whenExternalScripts(() =>
      partytown({
        config: { forward: ['dataLayer.push'] },
      })
    ),

    compress({
      CSS: true,
      HTML: {
        'html-minifier-terser': {
          removeAttributeQuotes: false,
        },
      },
      Image: false,
      JavaScript: true,
      SVG: false,
      Logger: 1,
    }),
  ],

  image: {
    domains: ['cdn.pixabay.com'],
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '~': path.resolve(__dirname, './src'),
      },
    },
  },
});