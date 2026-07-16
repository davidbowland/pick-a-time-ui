import { addDays, formatExpiration, formatShortDate, isWeekendDate, toIsoDate } from './dates'

describe('toIsoDate', () => {
  it('formats a local Date as YYYY-MM-DD, zero-padded', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
})

describe('addDays', () => {
  it('adds days within the same month', () => {
    expect(addDays('2026-07-14', 2)).toBe('2026-07-16')
  })

  it('rolls over into the next month', () => {
    expect(addDays('2026-07-30', 3)).toBe('2026-08-02')
  })
})

describe('formatShortDate', () => {
  it('formats as "Weekday, Month Day"', () => {
    expect(formatShortDate('2026-07-16')).toBe('Thu, Jul 16')
  })
})

describe('formatExpiration', () => {
  it('formats an expiration timestamp as a plain date and time in the given zone', () => {
    const expirationSeconds = Date.UTC(2026, 7, 24, 17, 30) / 1000 // 2026-08-24T17:30:00Z
    expect(formatExpiration(expirationSeconds, 'America/Chicago')).toBe('Closes Aug 24, 2026 at 12:30 PM')
  })

  it('renders a different clock time and date for a different zone from the same instant', () => {
    const expirationSeconds = Date.UTC(2026, 7, 24, 17, 30) / 1000 // 2026-08-24T17:30:00Z
    expect(formatExpiration(expirationSeconds, 'Asia/Tokyo')).toBe('Closes Aug 25, 2026 at 2:30 AM')
  })
})

describe('isWeekendDate', () => {
  it('returns true for a Saturday in the given timezone', () => {
    expect(isWeekendDate('2026-07-18', 'America/Chicago')).toBe(true)
  })

  it('returns true for a Sunday in the given timezone', () => {
    expect(isWeekendDate('2026-07-19', 'America/Chicago')).toBe(true)
  })

  it('returns false for a weekday in the given timezone', () => {
    expect(isWeekendDate('2026-07-16', 'America/Chicago')).toBe(false)
  })

  it('resolves the weekday in the given timezone, not implicitly in whatever zone the runtime defaults to', () => {
    expect(isWeekendDate('2026-07-18', 'Asia/Tokyo')).toBe(true) // still Saturday in Tokyo
    expect(isWeekendDate('2026-07-20', 'Asia/Tokyo')).toBe(false) // Monday in Tokyo
  })
})
