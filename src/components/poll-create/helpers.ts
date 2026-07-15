import { formatSlotMinutesLabel } from './time-fields'
import { addDays } from '@utils/dates'
import { formatSlotRange } from '@utils/time'

function isoWeekday(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

export function generateWeekdayDates(weekdays: number[], weekCount: number, anchorDate: string): string[] {
  const dates: string[] = []
  for (const weekday of weekdays) {
    const diff = (weekday - isoWeekday(anchorDate) + 7) % 7
    const firstOccurrence = addDays(anchorDate, diff)
    for (let week = 0; week < weekCount; week++) {
      dates.push(addDays(firstOccurrence, week * 7))
    }
  }
  return dates.sort()
}

const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Finds a rotation of the week (0=Sun..6=Sat) under which `sorted` is exactly the contiguous
// block [start, start+1, ..., start+n-1] (mod 7) — this recognizes both ordinary ranges
// (Mon-Fri) and ranges that wrap past Saturday into Sunday (Fri-Sat-Sun), since a week is
// circular. Returns the [start, end] weekday indices of that block, or undefined if `sorted`
// isn't a single contiguous run under any rotation.
function findContiguousRange(sorted: number[]): [start: number, end: number] | undefined {
  const n = sorted.length
  for (let start = 0; start < 7; start++) {
    const expected = Array.from({ length: n }, (_, i) => (start + i) % 7).sort((a, b) => a - b)
    if (expected.every((day, i) => day === sorted[i])) return [start, (start + n - 1) % 7]
  }
  return undefined
}

export function formatWeekdaysSummary(weekdays: number[]): string {
  if (weekdays.length === 0) return 'Not set yet'
  const sorted = [...weekdays].sort((a, b) => a - b)
  const range = findContiguousRange(sorted)
  if (range) {
    const [start, end] = range
    return start === end ? WEEKDAY_SHORT[start] : `${WEEKDAY_SHORT[start]}–${WEEKDAY_SHORT[end]}`
  }
  return sorted.map((d) => WEEKDAY_SHORT[d]).join(', ')
}

export function formatDaysTimesSummary(params: {
  dateCount: number
  daysLabel: string
  usesTimes: boolean
  startMinute: number
  endMinute: number
  slotMinutes: number
}): string {
  const dateLabel = params.dateCount === 1 ? '1 date' : `${params.dateCount} dates`
  const timeLabel = params.usesTimes
    ? `${formatSlotRange(params.startMinute, params.endMinute)} · ${formatSlotMinutesLabel(params.slotMinutes)}`
    : 'Dates only'
  return `${dateLabel} · ${params.daysLabel} · ${timeLabel}`
}

export function reconcilePatternDates(params: {
  currentDates: string[]
  previousPatternDates: string[]
  newPatternDates: string[]
  excludedDates: string[]
}): string[] {
  const previousPatternSet = new Set(params.previousPatternDates)
  const excludedSet = new Set(params.excludedDates)
  const keptNonPattern = params.currentDates.filter((d) => !previousPatternSet.has(d))
  const newEligible = params.newPatternDates.filter((d) => !excludedSet.has(d))
  return [...new Set([...keptNonPattern, ...newEligible])].sort()
}

export function updateExcludedDates(params: {
  excludedDates: string[]
  previousDates: string[]
  nextDates: string[]
  patternDates: string[]
}): string[] {
  const nextSet = new Set(params.nextDates)
  const patternSet = new Set(params.patternDates)
  const newlyExcluded = params.previousDates.filter((d) => !nextSet.has(d) && patternSet.has(d))
  const previousSet = new Set(params.previousDates)
  const reincludedSet = new Set(params.nextDates.filter((d) => !previousSet.has(d)))
  return [...new Set([...params.excludedDates.filter((d) => !reincludedSet.has(d)), ...newlyExcluded])]
}
