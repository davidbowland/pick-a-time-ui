import React, { useEffect } from 'react'

import { useScrollProgress } from '@hooks/useScrollProgress'
import { pickAccessibleTextColor } from '@utils/contrast'

// Night -> day -> night as the visitor scrolls through the six-scene story.
const NIGHT = { r: 23, g: 23, b: 26 }
const DAY = { r: 242, g: 241, b: 238 }

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function mixHex(a: typeof NIGHT, b: typeof NIGHT, t: number): string {
  const toHexByte = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${toHexByte(mixChannel(a.r, b.r, t))}${toHexByte(mixChannel(a.g, b.g, t))}${toHexByte(mixChannel(a.b, b.b, t))}`
}

const ACCENT_HEX = '#3fae8a'

// `EyebrowTag` fills its pill with `--copy-color` (a solid, already-guaranteed-AA-against-the-page
// neutral) rather than a translucent accent tint, so this only ever has to contrast the accent
// green against that small, fixed set of chip colors (ink/bone, or black/white in the scroll
// dead zone) — not against the page background directly, which is what made the old
// tinted-pill version fragile. accent (#3fae8a) is AA on --ink but fails on --bone; accent-text
// (#1f6b52) is the reverse — pick whichever actually passes against the chip it's rendered on.
function eyebrowAccentFor(chipHex: string): string {
  return pickAccessibleTextColor(chipHex, { onLight: '#1f6b52', onDark: ACCENT_HEX })
}

export const SkyBackground = (): React.ReactNode => {
  const progress = useScrollProgress()
  // First half of the page: night -> day. Second half: day -> night.
  const dayness = progress < 0.5 ? progress / 0.5 : 1 - (progress - 0.5) / 0.5
  const backgroundHex = mixHex(NIGHT, DAY, dayness)
  const copyColor = pickAccessibleTextColor(backgroundHex)
  const eyebrowAccent = eyebrowAccentFor(copyColor)

  useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--copy-color', copyColor)
    root.style.setProperty('--eyebrow-accent', eyebrowAccent)
    return () => {
      root.style.removeProperty('--copy-color')
      root.style.removeProperty('--eyebrow-accent')
    }
  }, [copyColor, eyebrowAccent])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 transition-colors duration-200 ease-linear"
      style={{ backgroundColor: backgroundHex }}
    />
  )
}
