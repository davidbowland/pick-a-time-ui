import { readFileSync } from 'fs'
import { join } from 'path'

describe('_app.tsx fonts', () => {
  const source = readFileSync(join(process.cwd(), 'src/pages/_app.tsx'), 'utf-8')

  it('loads Fraunces Variable, not Bebas Neue', () => {
    expect(source).toMatch(/fraunces-latin-wght-normal\.woff2/)
    expect(source).not.toMatch(/bebas-neue/)
  })

  it('loads Plus Jakarta Sans Variable, not Outfit', () => {
    expect(source).toMatch(/plus-jakarta-sans-latin-wght-normal\.woff2/)
    expect(source).not.toMatch(/@fontsource/)
  })

  it('self-hosts both faces through next/font so they are preloaded', () => {
    expect(source).toMatch(/from 'next\/font\/local'/)
    expect(source.match(/preload: true/g)).toHaveLength(2)
  })

  it('keeps a declared generic at the end of each fallback chain', () => {
    expect(source).toMatch(/fallback: \['Georgia', 'serif'\]/)
    expect(source).toMatch(/fallback: \['Helvetica', 'sans-serif'\]/)
  })
})
