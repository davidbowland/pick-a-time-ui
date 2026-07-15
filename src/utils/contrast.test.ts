import { contrastRatio, pickAccessibleTextColor, relativeLuminance } from './contrast'

describe('relativeLuminance', () => {
  it('returns 0 for black', () => {
    expect(relativeLuminance('#000000')).toBeCloseTo(0, 4)
  })

  it('returns 1 for white', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 4)
  })

  it('expands a 3-digit hex before computing', () => {
    expect(relativeLuminance('#fff')).toBeCloseTo(relativeLuminance('#ffffff'), 4)
  })
})

describe('contrastRatio', () => {
  it('returns 21 for black on white', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0)
  })

  it('returns 1 for a color against itself', () => {
    expect(contrastRatio('#3fae8a', '#3fae8a')).toBeCloseTo(1, 4)
  })

  it('is symmetric regardless of argument order', () => {
    expect(contrastRatio('#17171a', '#f2f1ee')).toBeCloseTo(contrastRatio('#f2f1ee', '#17171a'), 4)
  })
})

describe('token audit — normal text needs >= 4.5:1', () => {
  it('bone body text on the ink background passes', () => {
    expect(contrastRatio('#f2f1ee', '#17171a')).toBeGreaterThanOrEqual(4.5)
  })

  it('ink body text on the bone background passes (homepage midday state)', () => {
    expect(contrastRatio('#17171a', '#f2f1ee')).toBeGreaterThanOrEqual(4.5)
  })

  it('ink button label text on the accent fill passes', () => {
    expect(contrastRatio('#17171a', '#3fae8a')).toBeGreaterThanOrEqual(4.5)
  })

  it('accent-text on the bone background passes', () => {
    expect(contrastRatio('#1f6b52', '#f2f1ee')).toBeGreaterThanOrEqual(4.5)
  })

  it('raw accent on white FAILS — documents why accent-text exists', () => {
    expect(contrastRatio('#3fae8a', '#ffffff')).toBeLessThan(4.5)
  })

  it('slate muted text on the ink background passes', () => {
    expect(contrastRatio('#9494a3', '#17171a')).toBeGreaterThanOrEqual(4.5)
  })

  it('slate-on-light muted text on the bone background passes', () => {
    expect(contrastRatio('#5c5c6b', '#f2f1ee')).toBeGreaterThanOrEqual(4.5)
  })
})

describe('pickAccessibleTextColor', () => {
  it('chooses dark ink text on a light background', () => {
    expect(pickAccessibleTextColor('#f2f1ee')).toBe('#17171a')
  })

  it('chooses light bone text on a dark background', () => {
    expect(pickAccessibleTextColor('#17171a')).toBe('#f2f1ee')
  })

  it('chooses ink text on the brightest heat-ramp step', () => {
    expect(pickAccessibleTextColor('#b4e4d3')).toBe('#17171a')
  })

  it('chooses bone text on the darkest heat-ramp step', () => {
    expect(pickAccessibleTextColor('#287156')).toBe('#f2f1ee')
  })

  it('always returns a choice meeting 4.5:1 against the given background across the full heat ramp', () => {
    const ramp = ['#287156', '#38a07a', '#55c39b', '#84d4b7', '#b4e4d3']
    for (const bg of ramp) {
      const fg = pickAccessibleTextColor(bg)
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('falls back to pure black/white when neither theme candidate clears AA (mid-luminance dead zone)', () => {
    // Independently confirmed to sit in the ~0.21-0.24 progress dead zone of the SkyBackground
    // night(#17171a) -> day(#f2f1ee) interpolation, where onLight/onDark both fail 4.5:1.
    const deadZoneBackground = '#7c7c7f'
    const fg = pickAccessibleTextColor(deadZoneBackground)
    expect(contrastRatio(fg, deadZoneBackground)).toBeGreaterThanOrEqual(4.5)
  })

  describe('full-range SkyBackground interpolation (night -> day -> night)', () => {
    // Mirrors sky-background/index.tsx's NIGHT/DAY constants and mixHex math exactly, so this
    // test exercises the real backgrounds the homepage ever renders, not a hand-picked sample.
    const NIGHT = { r: 23, g: 23, b: 26 }
    const DAY = { r: 242, g: 241, b: 238 }

    function mixChannel(a: number, b: number, t: number): number {
      return Math.round(a + (b - a) * t)
    }

    function mixHex(a: typeof NIGHT, b: typeof NIGHT, t: number): string {
      const toHexByte = (n: number): string => n.toString(16).padStart(2, '0')
      return `#${toHexByte(mixChannel(a.r, b.r, t))}${toHexByte(mixChannel(a.g, b.g, t))}${toHexByte(mixChannel(a.b, b.b, t))}`
    }

    function backgroundAtProgress(progress: number): string {
      const dayness = progress < 0.5 ? progress / 0.5 : 1 - (progress - 0.5) / 0.5
      return mixHex(NIGHT, DAY, dayness)
    }

    it('the default (copy-color) ink/bone candidates always clear 4.5:1 across the full scroll range', () => {
      for (let i = 0; i <= 100; i++) {
        const progress = i / 100
        const backgroundHex = backgroundAtProgress(progress)
        const fg = pickAccessibleTextColor(backgroundHex)
        expect(contrastRatio(fg, backgroundHex)).toBeGreaterThanOrEqual(4.5)
      }
    })

    it('the eyebrow-accent candidates always clear 4.5:1 across the full scroll range', () => {
      for (let i = 0; i <= 100; i++) {
        const progress = i / 100
        const backgroundHex = backgroundAtProgress(progress)
        const fg = pickAccessibleTextColor(backgroundHex, { onLight: '#1f6b52', onDark: '#3fae8a' })
        expect(contrastRatio(fg, backgroundHex)).toBeGreaterThanOrEqual(4.5)
      }
    })
  })
})
