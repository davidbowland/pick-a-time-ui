import { toSpokenCode } from './spoken-code'

describe('toSpokenCode', () => {
  it('reads a hyphenated code as space-separated words', () => {
    expect(toSpokenCode('lazy-giraffe')).toBe('lazy giraffe')
  })

  it('replaces every hyphen, not just the first', () => {
    expect(toSpokenCode('very-lazy-giraffe')).toBe('very lazy giraffe')
  })

  it('leaves a code with no hyphen unchanged', () => {
    expect(toSpokenCode('giraffe')).toBe('giraffe')
  })
})
