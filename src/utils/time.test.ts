import {
  formatGridTime,
  formatMinuteOfDay,
  formatSlotDuration,
  formatSlotRange,
  hasUniformDuration,
  toClockParts,
  fromClockParts,
} from './time'

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

describe('formatGridTime', () => {
  it('drops :00 from a whole hour', () => {
    expect(formatGridTime(540, false)).toBe('9')
    expect(formatGridTime(540, true)).toBe('9a')
  })

  it('keeps the minutes on a half or quarter hour', () => {
    expect(formatGridTime(570, true)).toBe('9:30a')
    expect(formatGridTime(555, true)).toBe('9:15a')
  })

  it('uses 12a and 12p rather than Midnight and Noon', () => {
    expect(formatGridTime(720, true)).toBe('12p')
    expect(formatGridTime(0, true)).toBe('12a')
  })

  it('marks afternoon hours with p', () => {
    expect(formatGridTime(780, true)).toBe('1p')
  })

  it('normalizes a minute past the end of the day', () => {
    expect(formatGridTime(1440, true)).toBe('12a')
    expect(formatGridTime(1470, false)).toBe('12:30')
  })
})

describe('formatSlotDuration', () => {
  const columnsOf = (durationMinutes: number, count: number): { endMinute: number; startMinute: number }[] =>
    Array.from({ length: count }, (_, index) => ({
      endMinute: 540 + index * durationMinutes + durationMinutes,
      startMinute: 540 + index * durationMinutes,
    }))

  it('names a uniform one-hour cadence', () => {
    expect(formatSlotDuration(columnsOf(60, 4))).toBe('Each column is a 1-hour slot.')
  })

  it('names a uniform multi-hour cadence', () => {
    expect(formatSlotDuration(columnsOf(120, 3))).toBe('Each column is a 2-hour slot.')
  })

  it('names a uniform sub-hour cadence in minutes', () => {
    expect(formatSlotDuration(columnsOf(30, 4))).toBe('Each column is a 30-minute slot.')
    expect(formatSlotDuration(columnsOf(90, 2))).toBe('Each column is a 90-minute slot.')
  })

  it('returns nothing when durations vary, since no single line can state them', () => {
    expect(
      formatSlotDuration([
        { endMinute: 600, startMinute: 540 },
        { endMinute: 720, startMinute: 600 },
      ]),
    ).toBeUndefined()
  })

  it('returns nothing when there are no columns', () => {
    expect(formatSlotDuration([])).toBeUndefined()
  })

  it('states no cadence for a zero-length column rather than "a 0-hour slot"', () => {
    expect(formatSlotDuration([{ endMinute: 540, startMinute: 540 }])).toBeUndefined()
  })
})

describe('hasUniformDuration', () => {
  it('is true when every column spans the same minutes', () => {
    expect(
      hasUniformDuration([
        { endMinute: 600, startMinute: 540 },
        { endMinute: 660, startMinute: 600 },
      ]),
    ).toBe(true)
  })

  it('is false when a column spans a different number of minutes', () => {
    expect(
      hasUniformDuration([
        { endMinute: 600, startMinute: 540 },
        { endMinute: 720, startMinute: 600 },
      ]),
    ).toBe(false)
  })

  it('is false when there are no columns', () => {
    expect(hasUniformDuration([])).toBe(false)
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
