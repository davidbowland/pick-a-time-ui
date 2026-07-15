import { formatMinuteOfDay, formatSlotRange } from './time'

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
