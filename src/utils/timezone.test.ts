import { formatViewerSlotLabel, getZonedComponents, toViewerLocal, toViewerLocalSlot } from './timezone'

describe('getZonedComponents', () => {
  it('converts a UTC instant to date/time components in a zone behind UTC', () => {
    const utcMs = Date.UTC(2026, 5, 10, 1, 0) // 2026-06-10T01:00:00Z
    expect(getZonedComponents(utcMs, 'America/Chicago')).toEqual({ date: '2026-06-09', minuteOfDay: 20 * 60 })
  })

  it('converts a UTC instant to date/time components in a zone ahead of UTC', () => {
    const utcMs = Date.UTC(2026, 5, 10, 1, 0) // 2026-06-10T01:00:00Z
    expect(getZonedComponents(utcMs, 'Asia/Tokyo')).toEqual({ date: '2026-06-10', minuteOfDay: 10 * 60 })
  })
})

describe('toViewerLocal', () => {
  it('converts within the same calendar day when there is no midnight crossing', () => {
    expect(toViewerLocal('2026-01-15', 600, 'America/Chicago', 'America/New_York')).toEqual({
      date: '2026-01-15',
      minuteOfDay: 660,
      dayOffset: 0,
    })
  })

  it('flags a forward day crossing when the conversion pushes past midnight', () => {
    expect(toViewerLocal('2026-01-15', 1380, 'America/Chicago', 'Asia/Kolkata')).toEqual({
      date: '2026-01-16',
      minuteOfDay: 630,
      dayOffset: 1,
    })
  })

  it('flags a backward day crossing when the conversion falls before midnight', () => {
    expect(toViewerLocal('2026-01-15', 30, 'America/Chicago', 'Pacific/Honolulu')).toEqual({
      date: '2026-01-14',
      minuteOfDay: 1230,
      dayOffset: -1,
    })
  })

  it('accounts for a DST transition between two poll dates', () => {
    // 10:00 AM America/New_York on either side of the 2026-03-08 spring-forward transition,
    // both converted to UTC — the hour gap proves the offset was derived per-date, not cached.
    expect(toViewerLocal('2026-03-07', 600, 'America/New_York', 'UTC')).toEqual({
      date: '2026-03-07',
      minuteOfDay: 900,
      dayOffset: 0,
    })
    expect(toViewerLocal('2026-03-09', 600, 'America/New_York', 'UTC')).toEqual({
      date: '2026-03-09',
      minuteOfDay: 840,
      dayOffset: 0,
    })
  })

  it('crosses a year boundary correctly', () => {
    expect(toViewerLocal('2025-12-31', 1400, 'America/Chicago', 'Asia/Tokyo')).toEqual({
      date: '2026-01-01',
      minuteOfDay: 860,
      dayOffset: 1,
    })
  })
})

describe('toViewerLocalSlot', () => {
  it('derives a full slot from the start time, preserving duration', () => {
    expect(toViewerLocalSlot('2026-06-10', 1200, 1260, 'America/Chicago', 'Asia/Tokyo')).toEqual({
      date: '2026-06-11',
      startMinute: 600,
      endMinute: 660,
      dayOffset: 1,
    })
  })
})

describe('formatViewerSlotLabel', () => {
  it('formats a same-zone slot with no day-crossing flag', () => {
    expect(formatViewerSlotLabel('2026-06-10', 1200, 1260, 'America/Chicago', 'America/Chicago')).toBe('8:00–9:00 PM')
  })

  it('appends a next-day flag when the conversion crosses into the next calendar day', () => {
    expect(formatViewerSlotLabel('2026-06-10', 1200, 1260, 'America/Chicago', 'Asia/Tokyo')).toBe(
      '10:00–11:00 AM (next day for you)',
    )
  })

  it('appends a previous-day flag when the conversion crosses into the previous calendar day', () => {
    expect(formatViewerSlotLabel('2026-01-15', 30, 90, 'America/Chicago', 'Pacific/Honolulu')).toBe(
      '8:30–9:30 PM (previous day for you)',
    )
  })
})

describe('graceful degradation for an invalid timezone', () => {
  it('falls back instead of throwing when the poll timezone is invalid', () => {
    expect(() => toViewerLocal('2026-01-15', 600, 'Not/A_Real_Zone', 'America/Chicago')).not.toThrow()
  })

  it('falls back instead of throwing when the viewer timezone is invalid', () => {
    expect(() => toViewerLocal('2026-01-15', 600, 'America/Chicago', 'Not/A_Real_Zone')).not.toThrow()
  })

  it('returns the original date/time unchanged (true no-op) when the poll timezone is invalid', () => {
    expect(toViewerLocal('2026-01-15', 600, 'Not/A_Real_Zone', 'America/Chicago')).toEqual({
      date: '2026-01-15',
      minuteOfDay: 600,
      dayOffset: 0,
    })
  })
})

describe('getZonedComponents graceful degradation for a non-finite instant', () => {
  it('returns a safe default instead of throwing when the instant is NaN', () => {
    expect(() => getZonedComponents(NaN, 'America/Chicago')).not.toThrow()
    expect(getZonedComponents(NaN, 'America/Chicago')).toEqual({ date: '1970-01-01', minuteOfDay: 0 })
  })
})
