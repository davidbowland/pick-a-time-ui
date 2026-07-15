import { readFileSync } from 'fs'
import { join } from 'path'

describe('_document.tsx favicon links', () => {
  const source = readFileSync(join(process.cwd(), 'src/pages/_document.tsx'), 'utf-8')

  it('links the svg favicon', () => {
    expect(source).toMatch(/href="\/favicon\.svg"/)
  })

  it('links an ico fallback', () => {
    expect(source).toMatch(/href="\/favicon\.ico"/)
  })

  it('links the apple touch icon', () => {
    expect(source).toMatch(/href="\/apple-touch-icon\.png"/)
  })

  it('links the web manifest', () => {
    expect(source).toMatch(/href="\/site\.webmanifest"/)
  })
})
