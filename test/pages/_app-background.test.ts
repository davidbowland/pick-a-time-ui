import { readFileSync } from 'fs'
import { join } from 'path'

describe('_app.tsx background', () => {
  const source = readFileSync(join(process.cwd(), 'src/pages/_app.tsx'), 'utf-8')

  it('uses the --ink design token for the app shell background', () => {
    expect(source).toMatch(/bg-\[var\(--ink\)\]/)
  })

  it('does not use the old Arena near-black background color', () => {
    expect(source).not.toMatch(/#0A0A0B/)
    expect(source).not.toMatch(/bg-\[#0A0A0B\]/)
  })

  it('does not render the leftover Arena amber/orange gradient orbs', () => {
    expect(source).not.toMatch(/rgba\(245,158,11/)
    expect(source).not.toMatch(/rgba\(234,88,12/)
  })
})
