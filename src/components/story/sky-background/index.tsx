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

// accent (#3fae8a) is AA on --ink but fails on --bone; accent-text (#1f6b52) is the reverse —
// pick whichever of the two actually passes against the currently-interpolated background,
// rather than assuming one theme.
function eyebrowAccentFor(backgroundHex: string): string {
  return pickAccessibleTextColor(backgroundHex, { onLight: '#1f6b52', onDark: '#3fae8a' })
}

export const SkyBackground = (): React.ReactNode => {
  const progress = useScrollProgress()
  // First half of the page: night -> day. Second half: day -> night.
  const dayness = progress < 0.5 ? progress / 0.5 : 1 - (progress - 0.5) / 0.5
  const backgroundHex = mixHex(NIGHT, DAY, dayness)
  const copyColor = pickAccessibleTextColor(backgroundHex)
  const eyebrowAccent = eyebrowAccentFor(backgroundHex)

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
