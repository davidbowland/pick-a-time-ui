import { readFileSync } from 'fs'
import { join } from 'path'

import { contrastRatio, pickAccessibleTextColor } from '@utils/contrast'

function readCssVar(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} not found in index.css`)
  return match[1].trim()
}

const VAR_REFERENCE = /^var\(\s*--([\w-]+)\s*\)$/

// Tokens that alias another token (--danger-foreground: var(--ink)) have to be followed to a
// literal colour before any contrast maths can run on them.
function resolveCssVar(css: string, name: string): string {
  const raw = readCssVar(css, name)
  const reference = VAR_REFERENCE.exec(raw)
  return reference ? resolveCssVar(css, reference[1]) : raw
}

describe('design tokens in index.css', () => {
  const css = readFileSync(join(process.cwd(), 'src/assets/css/index.css'), 'utf-8')

  it.each([
    ['ink', '#17171a'],
    ['bone', '#f2f1ee'],
    ['accent', '#3fae8a'],
    ['accent-soft', '#7ecdb3'],
    ['accent-text', '#1f6b52'],
    ['slate', '#9494a3'],
    ['slate-on-light', '#5c5c6b'],
  ])('defines --%s as the audited value %s', (name, value) => {
    expect(readCssVar(css, name)).toBe(value)
  })

  it('does not define the retired Arena double-bezel classes', () => {
    expect(css).not.toMatch(/\.arena-glass-outer/)
    expect(css).not.toMatch(/\.arena-glass-inner/)
    expect(css).not.toMatch(/\.arena-eyebrow/)
  })

  it('does not define the retired indigo tokens', () => {
    expect(css).not.toMatch(/--indigo:/)
    expect(css).not.toMatch(/--indigo-soft:/)
  })

  it('the bone-on-ink body text pairing still passes AA in the shipped file', () => {
    expect(contrastRatio(readCssVar(css, 'bone'), readCssVar(css, 'ink'))).toBeGreaterThanOrEqual(4.5)
  })

  it('the accent-on-ink pairing (brand text, active states) passes AA', () => {
    expect(contrastRatio(readCssVar(css, 'accent'), readCssVar(css, 'ink'))).toBeGreaterThanOrEqual(4.5)
  })

  it('the accent-text-on-white pairing (phone-mockup links) passes AA', () => {
    expect(contrastRatio(readCssVar(css, 'accent-text'), '#ffffff')).toBeGreaterThanOrEqual(4.5)
  })

  it.each([
    ['heat-0', '#287156'],
    ['heat-1', '#38a07a'],
    ['heat-2', '#55c39b'],
    ['heat-3', '#84d4b7'],
    ['heat-4', '#b4e4d3'],
  ])('defines --%s as the audited value %s', (name, value) => {
    expect(readCssVar(css, name)).toBe(value)
  })

  it('defines --danger as the audited value #eb7a6d', () => {
    expect(readCssVar(css, 'danger')).toBe('#eb7a6d')
  })

  // Asserted through the alias rather than as a second literal, matching how --color-warning
  // aliases --accent. Duplicating the hex in both places is how the twins drift apart later;
  // resolving it proves the alias actually lands on the audited value.
  it('defines --color-danger as an alias resolving to the audited value', () => {
    expect(readCssVar(css, 'color-danger')).toBe('var(--danger)')
    expect(resolveCssVar(css, 'color-danger')).toBe('#eb7a6d')
  })

  it.each([['danger-foreground'], ['color-danger-foreground']])('defines --%s as an alias of --ink', (name) => {
    expect(readCssVar(css, name)).toBe('var(--ink)')
  })

  it('the danger-on-ink pairing (a field error on the page background) passes AA', () => {
    expect(contrastRatio(resolveCssVar(css, 'danger'), resolveCssVar(css, 'ink'))).toBeGreaterThanOrEqual(4.5)
  })

  // Against --surface, not --danger. `--danger-foreground` resolves to `--ink` and contrast is
  // symmetric, so a danger-foreground-on-danger assertion is byte-identical to the one above and
  // could never fail on its own however its name reads. --surface is the background panels and
  // alerts actually paint on, and is the pairing that was genuinely untested.
  it('the danger-on-surface pairing (a field error inside a panel) passes AA', () => {
    expect(contrastRatio(resolveCssVar(css, 'danger'), resolveCssVar(css, 'surface'))).toBeGreaterThanOrEqual(4.5)
  })

  it('always returns a choice meeting 4.5:1 against the shipped heat ramp', () => {
    const ramp = ['heat-0', 'heat-1', 'heat-2', 'heat-3', 'heat-4'].map((name) => readCssVar(css, name))
    for (const bg of ramp) {
      const fg = pickAccessibleTextColor(bg)
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
