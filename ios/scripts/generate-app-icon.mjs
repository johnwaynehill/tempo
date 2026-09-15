#!/usr/bin/env node
/**
 * Render the iOS app icon PNGs from the SVG sources in ios/Branding/AppIcon.
 * Run from the repo root: node ios/scripts/generate-app-icon.mjs
 *
 * Uses `sharp` from the web app's node_modules (same as scripts/generate-icons.mjs).
 * The sources were exported from Figma "Tempo-Web", node 4:2; edit the SVGs and
 * re-run rather than editing the PNGs.
 */
import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const here = dirname(fileURLToPath(import.meta.url))
const sources = resolve(here, '../Branding/AppIcon')
const out = resolve(here, '../Tempo/Assets.xcassets/AppIcon.appiconset')

const variants = [
  // The default appearance must be fully opaque: iOS rejects app icons with an alpha channel.
  { svg: 'AppIcon-Light.svg', png: 'AppIcon-Light.png', opaque: true },
  // Dark and tinted keep a transparent background; the system draws its own backdrop.
  { svg: 'AppIcon-Dark.svg', png: 'AppIcon-Dark.png', opaque: false },
  { svg: 'AppIcon-Tinted.svg', png: 'AppIcon-Tinted.png', opaque: false },
]

for (const v of variants) {
  // Render at 2x density and downsample to 1024 for clean curve edges.
  let img = sharp(readFileSync(resolve(sources, v.svg)), { density: 144 }).resize(1024, 1024)
  if (v.opaque) img = img.flatten({ background: '#ffffff' }).removeAlpha()
  await img.png().toFile(resolve(out, v.png))
  console.log(`✓ ${v.png}`)
}
