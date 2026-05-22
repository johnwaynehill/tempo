import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Proxy target for /api/* in dev. Defaults to the local API server.
  // Set VITE_API_URL in your .env to point elsewhere (e.g. the production API).
  const apiTarget = env.VITE_API_URL || 'http://localhost:3001'

  return {
  plugins: [
    react(),
    tailwindcss(),
    // Make folder-with-index static pages reachable at the bare path in dev,
    // matching `serve-handler`'s directory-index behavior in production. Vite
    // dev's static middleware doesn't auto-serve `public/foo/index.html` for
    // a request to `/foo`, so the SPA catch-all swallows it. Add specific
    // pages here when they're moved to subdirectories.
    {
      name: 'static-folder-index',
      configureServer(server) {
        const staticPaths = ['/design-system']
        server.middlewares.use((req, _res, next) => {
          if (!req.url) return next()
          const path = req.url.split('?')[0]
          for (const p of staticPaths) {
            if (path === p || path === p + '/') {
              req.url = p + '/index.html' + (req.url.slice(path.length).startsWith('?')
                ? req.url.slice(path.length)
                : '')
              break
            }
          }
          next()
        })
      },
    },
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.svg',
        'favicon-32x32.png',
        'favicon-16x16.png',
        'apple-touch-icon.png',
      ],
      manifest: {
        name: 'Tempo',
        short_name: 'Tempo',
        description: 'ADHD-first personal productivity app',
        theme_color: '#4f645b',
        background_color: '#f9f9f8',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // App shell: pre-cache built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Runtime cache: Google Fonts so the app looks right offline
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-stylesheets',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': '/src',
    },
  },
  server: {
    proxy: {
      // Direct passthrough to Anthropic for local dev — bypasses the prod proxy.
      // (Order matters: this MUST come before the catch-all `/api` rule below
      // so the more specific path wins.)
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/anthropic/, ''),
      },
      // Forward all other `/api/*` calls to VITE_API_URL (default: local API
      // on :3001). The frontend always uses same-origin paths in dev, so this
      // proxy is the only thing that reaches the upstream API. Keeps phone-on-
      // LAN testing CORS-free since the phone only ever talks to Vite.
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
  }
})
