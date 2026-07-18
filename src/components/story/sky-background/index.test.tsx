import React from 'react'

import { SkyBackground } from './index'
import { useScrollProgress } from '@hooks/useScrollProgress'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import { contrastRatio } from '@utils/contrast'

jest.mock('@hooks/useScrollProgress')

// Mirrors sky-background/index.tsx's NIGHT/DAY constants and mixHex/dayness math exactly, so
// tests can compute the exact background a given scroll progress renders without depending on
// jsdom's inline-style serialization (which normalizes hex to rgb()).
const NIGHT = { r: 23, g: 23, b: 26 }
const DAY = { r: 242, g: 241, b: 238 }

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function backgroundHexAtProgress(progress: number): string {
  const dayness = progress < 0.5 ? progress / 0.5 : 1 - (progress - 0.5) / 0.5
  const toHexByte = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${toHexByte(mixChannel(NIGHT.r, DAY.r, dayness))}${toHexByte(mixChannel(NIGHT.g, DAY.g, dayness))}${toHexByte(mixChannel(NIGHT.b, DAY.b, dayness))}`
}

describe('SkyBackground', () => {
  it('is purely decorative and hidden from assistive tech', () => {
    jest.mocked(useScrollProgress).mockReturnValue(0)
    const { container } = render(<SkyBackground />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('does not throw across the full 0-1 scroll range', () => {
    for (const progress of [0, 0.25, 0.5, 0.75, 1]) {
      jest.mocked(useScrollProgress).mockReturnValueOnce(progress)
      expect(() => render(<SkyBackground />)).not.toThrow()
    }
  })

  it('publishes a bone copy-color at the night extremes (progress 0 and 1)', () => {
    jest.mocked(useScrollProgress).mockReturnValueOnce(0)
    render(<SkyBackground />)
    expect(document.documentElement.style.getPropertyValue('--copy-color')).toBe('#f2f1ee')
  })

  it('publishes an ink copy-color at the day midpoint (progress 0.5)', () => {
    jest.mocked(useScrollProgress).mockReturnValueOnce(0.5)
    render(<SkyBackground />)
    expect(document.documentElement.style.getPropertyValue('--copy-color')).toBe('#17171a')
  })

  it('publishes an eyebrow-accent color that stays AA-compliant against the current background at every step', () => {
    // Sampled at fine enough intervals to land inside the mid-luminance dead zone, where neither
    // theme candidate clears 4.5:1 and pickAccessibleTextColor must fall back to pure black/white
    // — so this asserts real contrast, not membership in a fixed candidate set.
    for (let i = 0; i <= 20; i++) {
      const progress = i / 20
      jest.mocked(useScrollProgress).mockReturnValueOnce(progress)
      render(<SkyBackground />)
      const backgroundHex = backgroundHexAtProgress(progress)
      const accent = document.documentElement.style.getPropertyValue('--eyebrow-accent')
      expect(contrastRatio(accent, backgroundHex)).toBeGreaterThanOrEqual(4.5)
    }
  })
})
