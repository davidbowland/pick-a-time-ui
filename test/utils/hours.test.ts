import { getTodayHours, isClosedToday } from '@utils/hours'

// Jan 7 2024 = Sunday (day 0), Jan 8 = Monday (day 1), Jan 9 = Tuesday (day 2)
const SUNDAY = () => new Date(2024, 0, 7, 12, 0, 0)
const MONDAY = () => new Date(2024, 0, 8, 12, 0, 0)
const TUESDAY = () => new Date(2024, 0, 9, 12, 0, 0)

describe('isClosedToday', () => {
  it('returns true when today is listed as Closed', () => {
    const hours = ['Sunday: Closed', 'Monday: 11:00 AM – 9:00 PM']
    expect(isClosedToday(hours, SUNDAY)).toBe(true)
  })

  it('returns false when today has open hours', () => {
    const hours = ['Sunday: Closed', 'Monday: 11:00 AM – 9:00 PM']
    expect(isClosedToday(hours, MONDAY)).toBe(false)
  })

  it('returns false when today has no entry in the array', () => {
    const hours = ['Monday: 11:00 AM – 9:00 PM', 'Tuesday: 11:00 AM – 9:00 PM']
    expect(isClosedToday(hours, SUNDAY)).toBe(false)
  })

  it('returns false for an empty hours array', () => {
    expect(isClosedToday([], MONDAY)).toBe(false)
  })

  it('is case-insensitive when checking for "closed"', () => {
    const hours = ['Tuesday: CLOSED']
    expect(isClosedToday(hours, TUESDAY)).toBe(true)
  })
})

describe('getTodayHours', () => {
  it('returns the time range for an open day', () => {
    const hours = ['Sunday: Closed', 'Monday: 11:00 AM – 9:00 PM']
    expect(getTodayHours(hours, MONDAY)).toBe('11:00 AM – 9:00 PM')
  })

  it('returns null for a closed day', () => {
    const hours = ['Sunday: Closed', 'Monday: 11:00 AM – 9:00 PM']
    expect(getTodayHours(hours, SUNDAY)).toBeNull()
  })

  it('returns null when today has no entry', () => {
    const hours = ['Monday: 11:00 AM – 9:00 PM']
    expect(getTodayHours(hours, SUNDAY)).toBeNull()
  })

  it('returns null for an empty array', () => {
    expect(getTodayHours([], MONDAY)).toBeNull()
  })
})
