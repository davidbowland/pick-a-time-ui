import { formatMinuteOfDay, formatSlotRange, toClockParts, fromClockParts } from './time'

describe('formatMinuteOfDay', () => {
  it('formats midnight', () => {
    expect(formatMinuteOfDay(0)).toBe('12:00 AM')
  })

  it('formats noon', () => {
    expect(formatMinuteOfDay(720)).toBe('12:00 PM')
  })

  it('formats a morning time with a non-zero minute', () => {
    expect(formatMinuteOfDay(555)).toBe('9:15 AM')
  })

  it('formats an evening time', () => {
    expect(formatMinuteOfDay(1260)).toBe('9:00 PM')
  })

  it('formats one minute before midnight', () => {
    expect(formatMinuteOfDay(1439)).toBe('11:59 PM')
  })

  it("formats 1440 (a dates-only poll's implicit slot end) as midnight", () => {
    expect(formatMinuteOfDay(1440)).toBe('12:00 AM')
  })
})

describe('formatSlotRange', () => {
  it('formats a one-hour range', () => {
    expect(formatSlotRange(540, 600)).toBe('9:00–10:00 AM')
  })

  it('formats a range crossing noon', () => {
    expect(formatSlotRange(690, 750)).toBe('11:30 AM–12:30 PM')
  })

  it('formats a range entirely in the evening', () => {
    expect(formatSlotRange(1050, 1140)).toBe('5:30–7:00 PM')
  })

  it('formats a range ending exactly at midnight', () => {
    expect(formatSlotRange(1380, 1440)).toBe('11:00 PM–12:00 AM')
  })
})

describe('toClockParts', () => {
  it('splits a morning time into hour/minute/period', () => {
    expect(toClockParts(555)).toEqual({ hour12: 9, minute: 15, period: 'AM' })
  })

  it('splits an evening time into hour/minute/period', () => {
    expect(toClockParts(1260)).toEqual({ hour12: 9, minute: 0, period: 'PM' })
  })

  it('maps midnight to 12 AM', () => {
    expect(toClockParts(0)).toEqual({ hour12: 12, minute: 0, period: 'AM' })
  })

  it('maps noon to 12 PM', () => {
    expect(toClockParts(720)).toEqual({ hour12: 12, minute: 0, period: 'PM' })
  })
})

describe('fromClockParts', () => {
  it('combines hour/minute/period back into minute-of-day', () => {
    expect(fromClockParts(9, 15, 'AM')).toBe(555)
  })

  it('treats 12 AM as minute 0', () => {
    expect(fromClockParts(12, 0, 'AM')).toBe(0)
  })

  it('treats 12 PM as minute 720', () => {
    expect(fromClockParts(12, 0, 'PM')).toBe(720)
  })

  it('round-trips every quarter-hour of the day through toClockParts', () => {
    const minutes = Array.from({ length: 96 }, (_, i) => i * 15)
    const roundTripped = minutes.map((m) => {
      const parts = toClockParts(m)
      return fromClockParts(parts.hour12, parts.minute, parts.period)
    })
    expect(roundTripped).toEqual(minutes)
  })
})
