#!/usr/bin/env node
/**
 * Generate PWA icons from the SVG favicon.
 * Run: node scripts/generate-icons.mjs
 */
import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const publicDir = resolve(root, 'public')

// Read the source SVG
const svg = readFileSync(resolve(publicDir, 'favicon.svg'))

const icons = [
  { name: 'pwa-192x192.png', size: 192 },
  { name: 'pwa-512x512.png', size: 512 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32x32.png', size: 32 },
  { name: 'favicon-16x16.png', size: 16 },
]

mkdirSync(publicDir, { recursive: true })

for (const icon of icons) {
  await sharp(svg, { density: 400 })
    .resize(icon.size, icon.size)
    .png()
    .toFile(resolve(publicDir, icon.name))

  console.log(`✓ ${icon.name} (${icon.size}×${icon.size})`)
}

console.log('\nAll icons generated!')
