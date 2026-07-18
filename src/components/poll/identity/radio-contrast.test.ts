import { readFileSync } from 'fs'
import { join } from 'path'

import { contrastRatio } from '@utils/contrast'

function readCssVar(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} not found in index.css`)
  return match[1].trim()
}

function resolveVar(css: string, token: string): string {
  const match = token.match(/^var\(--([\w-]+)\)$/)
  return match ? readCssVar(css, match[1]) : token
}

const cssTokens = readFileSync(join(process.cwd(), 'src/assets/css/index.css'), 'utf-8')
const FIELD_BACKGROUND = resolveVar(cssTokens, readCssVar(cssTokens, 'field-background'))
const FIELD_BORDER = resolveVar(cssTokens, readCssVar(cssTokens, 'field-border'))
const HAIR = readCssVar(cssTokens, 'hair')

describe('radio/checkbox control border contrast', () => {
  it('meets the WCAG 1.4.11 non-text 3:1 minimum against the field background', () => {
    expect(contrastRatio(FIELD_BORDER, FIELD_BACKGROUND)).toBeGreaterThanOrEqual(3)
  })

  it('is not the original --hair token, confirming this is a real regression guard', () => {
    // --hair is a translucent (22%-alpha) line meant for large card/button outlines — against
    // the near-black field background it fell well short of 3:1, making unselected radio/
    // checkbox dots almost invisible.
    expect(HAIR).not.toBe(FIELD_BORDER)
  })
})
