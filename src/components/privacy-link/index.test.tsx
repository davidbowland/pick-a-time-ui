import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'

import PrivacyLink from './index'
import { contrastRatio } from '@utils/contrast'

// Real shipped design tokens (audited in test/utils/css-tokens.test.ts) — read from the
// source file itself so this test tracks reality rather than a copy-pasted assumption.
function readCssVar(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} not found in index.css`)
  return match[1].trim()
}

const cssTokens = readFileSync(join(process.cwd(), 'src/assets/css/index.css'), 'utf-8')
const SLATE = readCssVar(cssTokens, 'slate')
const INK = readCssVar(cssTokens, 'ink')

const source = readFileSync(join(process.cwd(), 'src/components/privacy-link/index.tsx'), 'utf-8')

describe('PrivacyLink', () => {
  it('links to the privacy policy page', () => {
    render(<PrivacyLink />)
    expect(screen.getByRole('link', { name: /privacy policy/i })).toHaveAttribute('href', '/privacy-policy')
  })

  it('renders text in the --slate token color', () => {
    // Confirms the component actually references --slate, not just that --slate happens to
    // pass AA in the abstract.
    expect(source).toMatch(/text-\[var\(--slate\)\]/)
  })

  it('uses a text color that passes AA against the dark app background', () => {
    // The color previously shipped here (#1F2937) is nearly the same as --ink
    // and fails contrast badly — this pins the fix.
    expect(contrastRatio(SLATE, INK)).toBeGreaterThanOrEqual(4.5)
  })
})
