import { readFileSync } from 'fs'
import { join } from 'path'

describe('_app.tsx font imports', () => {
  const source = readFileSync(join(process.cwd(), 'src/pages/_app.tsx'), 'utf-8')

  it('loads Fraunces Variable, not Bebas Neue', () => {
    expect(source).toMatch(/@fontsource-variable\/fraunces/)
    expect(source).not.toMatch(/@fontsource\/bebas-neue/)
  })

  it('loads Plus Jakarta Sans Variable, not Outfit', () => {
    expect(source).toMatch(/@fontsource-variable\/plus-jakarta-sans/)
    expect(source).not.toMatch(/@fontsource-variable\/outfit/)
  })
})
