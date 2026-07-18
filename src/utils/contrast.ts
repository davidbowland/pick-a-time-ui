function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '')
  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((c) => c + c)
          .join('')
      : normalized
  const num = parseInt(expanded, 16)
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

function linearize(channel: number): number {
  const s = channel / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

export function relativeLuminance(hex: string): number {
  const { r, g, b } = hexToRgb(hex)
  return 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
}

export function contrastRatio(hexA: string, hexB: string): number {
  const lumA = relativeLuminance(hexA)
  const lumB = relativeLuminance(hexB)
  const lighter = Math.max(lumA, lumB)
  const darker = Math.min(lumA, lumB)
  return (lighter + 0.05) / (darker + 0.05)
}

const AA_NORMAL_TEXT = 4.5

export function pickAccessibleTextColor(
  backgroundHex: string,
  options: { onLight?: string; onDark?: string } = {},
): string {
  const onLight = options.onLight ?? '#17171a'
  const onDark = options.onDark ?? '#f2f1ee'
  const lightContrast = contrastRatio(onDark, backgroundHex)
  const darkContrast = contrastRatio(onLight, backgroundHex)
  if (darkContrast >= AA_NORMAL_TEXT && darkContrast >= lightContrast) return onLight
  if (lightContrast >= AA_NORMAL_TEXT) return onDark
  // Neither theme candidate meets AA against this background (can happen in the mid-luminance
  // "dead zone" of an interpolated background). Fall back to pure black/white before giving up —
  // one of them is mathematically guaranteed to clear AA against any background (worst case
  // ~4.58:1, at the luminance crossover point where black and white contrast equally).
  const blackContrast = contrastRatio('#000000', backgroundHex)
  const whiteContrast = contrastRatio('#ffffff', backgroundHex)
  if (blackContrast >= AA_NORMAL_TEXT) return '#000000'
  if (whiteContrast >= AA_NORMAL_TEXT) return '#ffffff'
  // Should be unreachable given the black/white guarantee, but stay deterministic if it ever is.
  const candidates = [
    { color: onLight, contrast: darkContrast },
    { color: onDark, contrast: lightContrast },
    { color: '#000000', contrast: blackContrast },
    { color: '#ffffff', contrast: whiteContrast },
  ]
  return candidates.reduce((best, c) => (c.contrast > best.contrast ? c : best)).color
}
