import { readFileSync } from 'fs'
import { join } from 'path'

describe('_app.tsx viewport (AC-027)', () => {
  const source = readFileSync(join(process.cwd(), 'src/pages/_app.tsx'), 'utf-8')

  it('declares a viewport so safe-area insets resolve to something', () => {
    expect(source).toMatch(/name="viewport"/)
  })

  it('opts into the display cutout with viewport-fit=cover', () => {
    expect(source).toMatch(/content="width=device-width, initial-scale=1, viewport-fit=cover"/)
  })

  it('declares it through next/head, which is what dedupes it against Next’s default', () => {
    expect(source).toMatch(/from 'next\/head'/)
    const head = source.slice(source.indexOf('<Head>'), source.indexOf('</Head>'))
    expect(head).toMatch(/name="viewport"/)
  })
})
