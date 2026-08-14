/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import preact from '@preact/preset-vite'
import { VitePWA } from 'vite-plugin-pwa'
import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

/**
 * Dev-only data drop: the tablet POSTs the profile + trial log here and it
 * lands in exports/ on this machine for analysis. No backend anywhere else —
 * the static production build simply doesn't have this endpoint and the
 * button in the adult area reports "not available".
 */
function exportReceiver(): Plugin {
  const handler = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url !== '/api/export' || req.method !== 'POST') return next()
    let body = ''
    req.on('data', (c) => (body += c))
    req.on('end', () => {
      try {
        JSON.parse(body)
        mkdirSync('exports', { recursive: true })
        const file = `export-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
        writeFileSync(resolve('exports', file), body)
        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ ok: true, file }))
      } catch {
        res.statusCode = 400
        res.end(JSON.stringify({ ok: false }))
      }
    })
  }
  return {
    name: 'export-receiver',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  // Relative base so the same build works at / (LAN) and /<repo>/ (GitHub Pages).
  base: './',
  plugins: [
    preact(),
    exportReceiver(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/apple-touch-icon.png'],
      manifest: {
        name: 'Byg & Tæl',
        short_name: 'Byg & Tæl',
        lang: 'da',
        display: 'standalone',
        background_color: '#cfe6f2',
        theme_color: '#cfe6f2',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
