import { formatPhoneUS, isValidPhoneUS } from '@utils/phone'

describe('formatPhoneUS', () => {
  it('should strip non-digit characters', () => {
    expect(formatPhoneUS('(212) 555-1234')).toBe('+12125551234')
  })

  it('should prepend +1 to a 10-digit number starting with 2-9', () => {
    expect(formatPhoneUS('2125551234')).toBe('+12125551234')
  })

  it('should strip leading 1 and re-prepend +1', () => {
    expect(formatPhoneUS('12125551234')).toBe('+12125551234')
  })

  it('should handle input already prefixed with +1', () => {
    expect(formatPhoneUS('+12125551234')).toBe('+12125551234')
  })

  it('should truncate to 12 characters', () => {
    expect(formatPhoneUS('212555123499999')).toBe('+12125551234')
  })

  it('should return partial formatting for incomplete numbers', () => {
    expect(formatPhoneUS('212')).toBe('+1212')
  })

  it('should return empty string for empty input', () => {
    expect(formatPhoneUS('')).toBe('')
  })

  it('should not prepend +1 for numbers starting with 0 or 1', () => {
    // Starts with 0 — regex won't match, returns raw digits
    expect(formatPhoneUS('0125551234')).toBe('0125551234')
  })
})

describe('isValidPhoneUS', () => {
  it('should accept a valid +1 US number', () => {
    expect(isValidPhoneUS('+12125551234')).toBe(true)
  })

  it('should reject a number without +1 prefix', () => {
    expect(isValidPhoneUS('2125551234')).toBe(false)
  })

  it('should reject a number starting with 0 or 1 after country code', () => {
    expect(isValidPhoneUS('+10125551234')).toBe(false)
    expect(isValidPhoneUS('+11125551234')).toBe(false)
  })

  it('should reject too-short numbers', () => {
    expect(isValidPhoneUS('+1212555123')).toBe(false)
  })

  it('should reject too-long numbers', () => {
    expect(isValidPhoneUS('+121255512345')).toBe(false)
  })

  it('should reject empty string', () => {
    expect(isValidPhoneUS('')).toBe(false)
  })
})
