import { readFileSync } from 'fs'
import { join } from 'path'

import { contrastRatio, pickAccessibleTextColor } from '@utils/contrast'

function readCssVar(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} not found in index.css`)
  return match[1].trim()
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

  it('always returns a choice meeting 4.5:1 against the shipped heat ramp', () => {
    const ramp = ['heat-0', 'heat-1', 'heat-2', 'heat-3', 'heat-4'].map((name) => readCssVar(css, name))
    for (const bg of ramp) {
      const fg = pickAccessibleTextColor(bg)
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
