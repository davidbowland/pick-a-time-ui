import { formatGridTime, formatSlotRange, hasUniformDuration, toClockParts } from './time'

export function getZonedComponents(utcMs: number, timeZone: string): { date: string; minuteOfDay: number } {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
    const parts = formatter.formatToParts(new Date(utcMs))
    const get = (type: string): number => Number(parts.find((part) => part.type === type)?.value ?? 0)
    const year = get('year')
    const month = String(get('month')).padStart(2, '0')
    const day = String(get('day')).padStart(2, '0')
    // Some ICU implementations render midnight as "24" under hourCycle 'h23'; normalize it to 0.
    const hour = get('hour') % 24
    const minute = get('minute')
    return { date: `${year}-${month}-${day}`, minuteOfDay: hour * 60 + minute }
  } catch {
    if (timeZone !== 'UTC') return getZonedComponents(utcMs, 'UTC')
    return { date: '1970-01-01', minuteOfDay: 0 }
  }
}

function getTimeZoneOffsetMinutes(timeZone: string, utcMs: number): number {
  let offsetPart: string
  try {
    const formatter = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
    offsetPart = formatter.formatToParts(new Date(utcMs)).find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  } catch {
    return 0
  }
  if (offsetPart === 'GMT') return 0
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offsetPart)
  if (!match) return 0
  const sign = match[1] === '-' ? -1 : 1
  return sign * (Number(match[2]) * 60 + Number(match[3]))
}

function zonedToUtcMs(date: string, minuteOfDay: number, timeZone: string): number {
  const [year, month, day] = date.split('-').map(Number)
  const hour = Math.floor(minuteOfDay / 60)
  const minute = minuteOfDay % 60
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute)
  const offsetMinutes = getTimeZoneOffsetMinutes(timeZone, naiveUtcMs)
  return naiveUtcMs - offsetMinutes * 60_000
}

function dateDiffInDays(fromDate: string, toDate: string): number {
  const [fromYear, fromMonth, fromDay] = fromDate.split('-').map(Number)
  const [toYear, toMonth, toDay] = toDate.split('-').map(Number)
  const msPerDay = 86_400_000
  return Math.round((Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / msPerDay)
}

export interface LocalizedInstant {
  date: string
  minuteOfDay: number
  dayOffset: number
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return true
  } catch {
    return false
  }
}

export function toViewerLocal(
  date: string,
  minuteOfDay: number,
  pollTimezone: string,
  viewerTimezone: string,
): LocalizedInstant {
  if (!isValidTimeZone(pollTimezone) || !isValidTimeZone(viewerTimezone)) {
    return { date, minuteOfDay, dayOffset: 0 }
  }
  const utcMs = zonedToUtcMs(date, minuteOfDay, pollTimezone)
  const local = getZonedComponents(utcMs, viewerTimezone)
  return { date: local.date, minuteOfDay: local.minuteOfDay, dayOffset: dateDiffInDays(date, local.date) }
}

export interface LocalizedSlot {
  date: string
  startMinute: number
  endMinute: number
  dayOffset: number
}

export function toViewerLocalSlot(
  date: string,
  startMinute: number,
  endMinute: number,
  pollTimezone: string,
  viewerTimezone: string,
): LocalizedSlot {
  const start = toViewerLocal(date, startMinute, pollTimezone, viewerTimezone)
  const duration = endMinute - startMinute
  return {
    date: start.date,
    startMinute: start.minuteOfDay,
    endMinute: start.minuteOfDay + duration,
    dayOffset: start.dayOffset,
  }
}

export function formatViewerSlotLabel(
  date: string,
  startMinute: number,
  endMinute: number,
  pollTimezone: string,
  viewerTimezone: string,
): string {
  const local = toViewerLocalSlot(date, startMinute, endMinute, pollTimezone, viewerTimezone)
  const range = formatSlotRange(local.startMinute, local.endMinute)
  if (local.dayOffset > 0) return `${range} (next day for you)`
  if (local.dayOffset < 0) return `${range} (previous day for you)`
  return range
}

export interface GridSlotLabel {
  label: string
  dayOffset: number
}

// Column headers for the availability grids. Unlike formatViewerSlotLabel (which stays as-is for
// prose and the "Meeting time:" note), this drops every character the grid can infer, because the
// header string — not the tap target — is what sets column width under table layout.
//
// The period marker is on EVERY start, not only where the period changes. A change-only marker
// was tried and is wrong for this grid specifically: only ~5 of N columns are on screen and
// useInitialColumnScroll auto-scrolls before the user looks, so the marker scrolls off with its
// anchoring column — an afternoon view showed no AM/PM at all, and a noon-start series emitted
// labels identical to a midnight-start one. Dropping `:00` from whole hours pays for it.
//
// A contiguous column needs only its start: the next column's start IS this one's end. The final
// column also shows only its start when every slot shares one duration, because that duration is
// stated once above the grid (formatSlotDuration); when durations vary, no such line exists and
// the final column keeps its range. The condition is hasUniformDuration, not "formatSlotDuration
// returned a string", so a change to that copy cannot silently drop an end time nothing states.
// Ranges are otherwise reserved for genuine gaps, since one is
// 1.3-2x the 3rem (48px at a 16px root) column floor and would wrap the header to two lines under table-layout: fixed.
//
// Contiguity is judged on poll-timezone minutes, the authoritative slot geometry, since the
// viewer conversion is a uniform shift. Known pre-existing limitation: toViewerLocalSlot derives
// a local end as start + duration rather than converting it, so a slot spanning a DST transition
// reports an end that is off by the transition. Not introduced here and not fixed here.
//
// `columns` is typed structurally rather than as TimeWindow so this util doesn't depend on a
// component module; TimeWindow satisfies it.
export function buildGridSlotLabels(
  columns: { startMinute: number; endMinute: number }[],
  date: string,
  pollTimezone: string,
  viewerTimezone: string,
): GridSlotLabel[] {
  const locals = columns.map((column) =>
    toViewerLocalSlot(date, column.startMinute, column.endMinute, pollTimezone, viewerTimezone),
  )
  const uniformDuration = hasUniformDuration(columns)
  return locals.map((local, index) => {
    const start = formatGridTime(local.startMinute, true)
    const next = columns[index + 1]
    const contiguous = next !== undefined && next.startMinute === columns[index].endMinute
    if (contiguous || (next === undefined && uniformDuration)) return { dayOffset: local.dayOffset, label: start }

    const startPeriod = toClockParts(local.startMinute).period
    const endPeriod = toClockParts(local.endMinute).period
    const end = formatGridTime(local.endMinute, endPeriod !== startPeriod)
    return { dayOffset: local.dayOffset, label: `${start}–${end}` }
  })
}
