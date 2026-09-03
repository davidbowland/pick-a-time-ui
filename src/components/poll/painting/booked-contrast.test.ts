import { readFileSync } from 'fs'
import { join } from 'path'

import {
  BOOKED_CELL_FRAGMENT,
  CONFLICT_CELL_FRAGMENT,
  DISABLED_CELL_CLASS,
  UNMARKED_CELL_FRAGMENT,
} from '../slot-columns'
import { contrastRatio } from '@utils/contrast'

// Same shape as poll/identity/radio-contrast.test.ts and share/border-contrast.test.ts: this repo
// guards a non-text contrast rule by computing the real ratio from the stylesheet, never by
// asserting on a class name. A class assertion cannot fail when a token's VALUE moves, which is the
// only failure anyone cares about, and it fails spuriously on a rename, which nobody cares about.
//
// What is different here, and why this file exists at all: the booked and conflict treatments are
// the first indicators in the app that sit on a ground of their own rather than on the page. A
// `--slate` glyph clears 5.98:1 against `--ink` and only 3.80:1 against the translucent fill it is
// actually drawn on — so measuring against the page would report a number the reader never sees.
// AC-041 is measured against each indicator's OWN ground, which is what the compositing below is
// for.

function readCssVar(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} not found in index.css`)
  return match[1].trim()
}

function resolveVar(css: string, token: string): string {
  const match = token.match(/^var\(--([\w-]+)\)$/)
  return match ? readCssVar(css, match[1]) : token
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

// Reads a Tailwind color utility straight out of the class constant instead of restating its value,
// so the constant is what is under test. Both spellings the codebase uses are accepted: a bare
// percentage (`/16`) and the bracketed fraction it falls back to below 0.1 (`/[0.03]`).
function colorUtility(className: string, prefix: string): { alpha: number; token: string } {
  const match = className.match(new RegExp(`${prefix}-\\[var\\(--([\\w-]+)\\)\\](?:/(\\[[\\d.]+\\]|\\d+))?`))
  if (!match) throw new Error(`No \`${prefix}-[var(--token)]\` utility in "${className}"`)
  const [, token, rawAlpha] = match
  const alpha =
    rawAlpha === undefined ? 1 : Number(rawAlpha.replace(/[[\]]/g, '')) / (rawAlpha.startsWith('[') ? 1 : 100)
  return { alpha, token }
}

// The flattened color a utility actually paints, given what it is drawn over.
function paintedColor(className: string, prefix: string, groundHex: string): string {
  const { alpha, token } = colorUtility(className, prefix)
  return over(resolveVar(cssTokens, `var(--${token})`), alpha, groundHex)
}

const cssTokens = readFileSync(join(process.cwd(), 'src/assets/css/index.css'), 'utf-8')
// `--background` is `var(--ink)`: everything in the grid is ultimately drawn over the page.
const PAGE = resolveVar(cssTokens, readCssVar(cssTokens, 'background'))

// The ground each indicator sits on, not the page. This is the whole point of the file.
const BOOKED_FILL = paintedColor(BOOKED_CELL_FRAGMENT, 'bg', PAGE)
const CONFLICT_FILL = paintedColor(CONFLICT_CELL_FRAGMENT, 'bg', PAGE)
// Both non-color channels inherit `currentColor` from the cell — the `Clock` glyph through lucide's
// stroke, the conflict marker through `bg-current` — so the cell's own text utility IS the
// indicator color, and reading it here measures what the reader sees rather than a parallel copy.
const BOOKED_GLYPH = paintedColor(BOOKED_CELL_FRAGMENT, 'text', BOOKED_FILL)
const CONFLICT_MARKER = paintedColor(CONFLICT_CELL_FRAGMENT, 'text', CONFLICT_FILL)

// The fill PaintGrid gives an unpainted, unbooked cell. AC-014 is a comparison against that
// specific value, so it is read from the constant the grid actually renders rather than restated
// here — a copy would keep passing after the grid's own fill changed. This used to scrape
// grid.tsx for the one `--bone` utility in it, because the value was inline there; it is a named
// export now (the key draws it too), so the import does the same job without the file read.
const UNPAINTED_FILL = paintedColor(UNMARKED_CELL_FRAGMENT, 'bg', PAGE)

const NON_TEXT_MINIMUM = 3

describe('booked and conflict cell contrast', () => {
  it('draws the booked glyph at the WCAG 1.4.11 non-text 3:1 minimum against the booked fill', () => {
    // AC-041. Measured on the fill, not the page: `--slate` is 5.98:1 on `--ink` and loses roughly
    // two points of that once the translucent booked fill lightens the ground underneath it.
    expect(contrastRatio(BOOKED_GLYPH, BOOKED_FILL)).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
  })

  it('draws the conflict marker at the WCAG 1.4.11 non-text 3:1 minimum against the accent fill', () => {
    // AC-041. `--ink` is the only choice here: no color in the palette clears 3:1 against BOTH
    // `--ink` and `--accent` (the ceiling is ~2.17:1), so a marker that stayed legible on the page
    // would vanish on the fill it is drawn on.
    expect(contrastRatio(CONFLICT_MARKER, CONFLICT_FILL)).toBeGreaterThanOrEqual(NON_TEXT_MINIMUM)
  })

  it('keeps the conflict fill identical to the painted fill, so a conflict still reads as marked', () => {
    // AC-013. The conflict cell is a painted cell that also happens to be booked; changing its fill
    // would say the participant's own mark had been overruled, which is the one thing this feature
    // promised not to do.
    expect(CONFLICT_FILL).toBe(resolveVar(cssTokens, 'var(--accent)'))
  })

  it('makes the booked fill lighter than the unpainted fill and darker than the painted one', () => {
    // AC-013 and AC-014: three grounds, three distinct values, in a fixed order. Contrast against
    // the page is the measure of "louder" here, and the booked fill has to sit strictly between the
    // two states it could otherwise be mistaken for.
    expect(contrastRatio(BOOKED_FILL, PAGE)).toBeGreaterThan(contrastRatio(UNPAINTED_FILL, PAGE))
    expect(contrastRatio(BOOKED_FILL, PAGE)).toBeLessThan(contrastRatio(CONFLICT_FILL, PAGE))
  })

  it('does not reuse the out-of-window treatment for booked cells', () => {
    // AC-014. `border-dashed` and the near-invisible 3% fill belong to DISABLED_CELL_CLASS, which
    // means "there is no slot here" — the opposite claim to "you are busy here". A booked cell that
    // borrowed either channel would read as an inert placeholder.
    const disabledFill = paintedColor(DISABLED_CELL_CLASS, 'bg', PAGE)

    expect(contrastRatio(BOOKED_FILL, PAGE)).toBeGreaterThan(contrastRatio(disabledFill, PAGE))
  })
})
