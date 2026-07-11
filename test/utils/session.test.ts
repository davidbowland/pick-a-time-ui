import { isClosingSoonError } from '@utils/session'

describe('isClosingSoonError', () => {
  it('should return true for the exact backend closing-soon error message', () => {
    expect(
      isClosingSoonError(
        'Not enough restaurants are open right now (or staying open long enough). Try again later or disable the closing-soon filter.',
      ),
    ).toBe(true)
  })

  it('should return true for any message containing "closing-soon filter"', () => {
    expect(isClosingSoonError('Something about the closing-soon filter went wrong')).toBe(true)
  })

  it('should return false for a generic error message', () => {
    expect(
      isClosingSoonError('Not enough restaurants found. Try a different location or broader search criteria.'),
    ).toBe(false)
  })

  it('should return false for null', () => {
    expect(isClosingSoonError(null)).toBe(false)
  })

  it('should return false for undefined', () => {
    expect(isClosingSoonError(undefined)).toBe(false)
  })

  it('should return false for empty string', () => {
    expect(isClosingSoonError('')).toBe(false)
  })
})
