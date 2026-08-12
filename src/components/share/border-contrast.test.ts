import { readFileSync } from 'fs'
import { join } from 'path'

import { contrastRatio } from '@utils/contrast'

// Same shape as poll/identity/radio-contrast.test.ts, and deliberately so: that file established
// how this repo guards a non-text contrast rule, which is to compute the real ratio from the
// stylesheet rather than assert on a class name. A class assertion cannot fail when the token's
// VALUE drops below the floor, which is the only failure anyone cares about here — and it fails
// spuriously on a rename, which nobody cares about at all.

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
const INK = readCssVar(cssTokens, 'ink')
const FIELD_BORDER = resolveVar(cssTokens, readCssVar(cssTokens, 'field-border'))

describe('share-row control border contrast', () => {
  it('meets the WCAG 1.4.11 non-text 3:1 minimum against the page background', () => {
    expect(contrastRatio(FIELD_BORDER, INK)).toBeGreaterThanOrEqual(3)
  })

  it('is the token the share-row buttons actually use', () => {
    // Reads the component source, because the interesting regression is at the USE site, not in the
    // stylesheet. An earlier version of this test asserted `HAIR !== FIELD_BORDER`, which compares
    // two token values that are different by definition and stays green no matter what class
    // `BUTTON_CLASS` carries — a guard that could never fire.
    //
    // --hair is a 22%-alpha line for large decorative outlines. On the Share, Copy link and QR
    // buttons it computed to roughly 1.5:1 against the page and the controls read as unbordered,
    // which is what AC-051 fixed. Swapping it back passes every behavioural test in
    // share.test.tsx, so this is the only thing standing between that edit and a shipped
    // regression.
    const source = readFileSync(join(process.cwd(), 'src/components/share/elements.tsx'), 'utf-8')
    const buttonClass = source.match(/const BUTTON_CLASS = `([^`]*)`/)?.[1]

    expect(buttonClass).toContain('border-[var(--field-border)]')
    expect(buttonClass).not.toContain('--hair')
  })
})
