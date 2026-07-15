import { FOCUS_RING } from './focus-ring'

describe('FOCUS_RING', () => {
  it('is a non-empty string containing focus-visible styles', () => {
    expect(typeof FOCUS_RING).toBe('string')
    expect(FOCUS_RING.length).toBeGreaterThan(0)
    expect(FOCUS_RING).toContain('focus-visible')
  })
})
