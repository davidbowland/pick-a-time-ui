#!/usr/bin/env node
'use strict'

/*
 * Copy scripts/sw-src.js to out/sw.js.
 *
 * The worker is a build output rather than a checked-in `public/sw.js` so that the kill-switch
 * procedure in scripts/sw-killswitch.js stays a one-file swap: overwrite the source, push, and the
 * next deploy serves a different byte sequence at the same `/sw.js` URL.
 *
 * This runs LAST in `postbuild`. Everything before it writes into `out/` — and
 * scripts/generate-dynamic-pages.js both creates and deletes files there — so running earlier would
 * mean copying into a directory another step is still rearranging.
 */

const fs = require('fs')
const path = require('path')

const source = path.join(__dirname, 'sw-src.js')
const outDir = path.join(__dirname, '..', 'out')
const destination = path.join(outDir, 'sw.js')

// Fail loudly rather than creating `out/`. A missing `out/` means `next build` did not export, so
// creating the directory here would produce a deploy carrying a service worker and no site.
if (!fs.existsSync(outDir)) {
  console.error(`Cannot write ${destination}: ${outDir} does not exist. Run \`npm run build\` first.`)
  process.exit(1)
}

fs.copyFileSync(source, destination)

console.log('✓ Generated out/sw.js')
