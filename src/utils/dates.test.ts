import {
  addDays,
  buildGridDateLabels,
  formatCheckedAgo,
  formatExpiration,
  formatShortDate,
  isWeekendDate,
  toIsoDate,
} from './dates'

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

describe('buildGridDateLabels', () => {
  it('shows the month on the first row only, within one month', () => {
    expect(buildGridDateLabels(['2026-07-28', '2026-07-29', '2026-07-30'])).toEqual(['Tue Jul 28', 'Wed 29', 'Thu 30'])
  })

  it('shows the month again on a row entering a new month', () => {
    expect(buildGridDateLabels(['2026-07-30', '2026-07-31', '2026-08-01'])).toEqual([
      'Thu Jul 30',
      'Fri 31',
      'Sat Aug 1',
    ])
  })

  it('never includes a year, even across a year boundary', () => {
    expect(buildGridDateLabels(['2026-12-31', '2027-01-01'])).toEqual(['Thu Dec 31', 'Fri Jan 1'])
  })

  it('repeats the month when the same month recurs in a later year', () => {
    expect(buildGridDateLabels(['2026-07-28', '2027-07-28'])).toEqual(['Tue Jul 28', 'Wed Jul 28'])
  })

  it('compares against the previous listed date, not the previous calendar day', () => {
    expect(buildGridDateLabels(['2026-07-28', '2026-08-04', '2026-08-05'])).toEqual([
      'Tue Jul 28',
      'Tue Aug 4',
      'Wed 5',
    ])
  })

  it('shows the month for a single date', () => {
    expect(buildGridDateLabels(['2026-07-28'])).toEqual(['Tue Jul 28'])
  })

  it('returns an empty array for no dates', () => {
    expect(buildGridDateLabels([])).toEqual([])
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

describe('formatCheckedAgo', () => {
  const now = () => 1_754_006_400_000 // fixed; never read the wall clock in a test

  it('should read as just now under a minute', () => {
    expect(formatCheckedAgo(1_754_006_370, now)).toEqual('just now')
  })

  it('should count a single minute in the singular', () => {
    expect(formatCheckedAgo(1_754_006_330, now)).toEqual('1 minute ago')
  })

  it('should count minutes', () => {
    expect(formatCheckedAgo(1_754_006_280, now)).toEqual('2 minutes ago')
  })

  it('should count hours', () => {
    expect(formatCheckedAgo(1_754_002_800, now)).toEqual('1 hour ago')
  })

  it('should count days', () => {
    expect(formatCheckedAgo(1_753_920_000, now)).toEqual('1 day ago')
  })
})
