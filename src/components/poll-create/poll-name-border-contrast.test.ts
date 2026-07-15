import { readFileSync } from 'fs'
import { join } from 'path'

import { contrastRatio } from '@utils/contrast'

function readCssVar(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} not found in index.css`)
  return match[1].trim()
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.replace('#', ''), 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (c: number) => Math.round(c).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

// Standard "over" alpha compositing: result = fg*alpha + bg*(1-alpha).
function over(fgHex: string, alpha: number, bgHex: string): string {
  const fg = hexToRgb(fgHex)
  const bg = hexToRgb(bgHex)
  return toHex({
    r: fg.r * alpha + bg.r * (1 - alpha),
    g: fg.g * alpha + bg.g * (1 - alpha),
    b: fg.b * alpha + bg.b * (1 - alpha),
  })
}

const cssTokens = readFileSync(join(process.cwd(), 'src/assets/css/index.css'), 'utf-8')
const INK = readCssVar(cssTokens, 'ink')
const SLATE = readCssVar(cssTokens, 'slate')

describe('poll-name input border contrast', () => {
  it('meets the WCAG 1.4.11 non-text 3:1 minimum against the card background', () => {
    // PollNameField's input uses `border-[var(--slate)]/70` (see elements.tsx).
    const BORDER_ALPHA = 0.7
    const compositedBorder = over(SLATE, BORDER_ALPHA, INK)
    expect(contrastRatio(compositedBorder, INK)).toBeGreaterThanOrEqual(3)
  })

  it('would have failed against the original --hair alpha (0.22), confirming this is a real regression guard', () => {
    const ORIGINAL_HAIR_ALPHA = 0.22
    const compositedBorder = over(SLATE, ORIGINAL_HAIR_ALPHA, INK)
    expect(contrastRatio(compositedBorder, INK)).toBeLessThan(3)
  })
})
