export type ClockPeriod = 'AM' | 'PM'

export interface ClockParts {
  hour12: number
  minute: number
  period: ClockPeriod
}

export function toClockParts(minute: number): ClockParts {
  const normalized = ((minute % 1440) + 1440) % 1440
  const totalHour = Math.floor(normalized / 60)
  const minuteOfHour = normalized % 60
  const period: ClockPeriod = totalHour < 12 ? 'AM' : 'PM'
  const hour12 = totalHour % 12 === 0 ? 12 : totalHour % 12
  return { hour12, minute: minuteOfHour, period }
}

export function fromClockParts(hour12: number, minute: number, period: ClockPeriod): number {
  const hour24 = period === 'AM' ? hour12 % 12 : (hour12 % 12) + 12
  return hour24 * 60 + minute
}

function formatClock(minute: number): { hour12: number; minuteStr: string; period: ClockPeriod } {
  const { hour12, minute: minuteOfHour, period } = toClockParts(minute)
  return { hour12, minuteStr: String(minuteOfHour).padStart(2, '0'), period }
}

export function formatMinuteOfDay(minute: number): string {
  const { hour12, minuteStr, period } = formatClock(minute)
  return `${hour12}:${minuteStr} ${period}`
}

export function formatSlotRange(startMinute: number, endMinute: number): string {
  const start = formatClock(startMinute)
  const end = formatClock(endMinute)
  const startLabel =
    start.period === end.period
      ? `${start.hour12}:${start.minuteStr}`
      : `${start.hour12}:${start.minuteStr} ${start.period}`
  return `${startLabel}–${end.hour12}:${end.minuteStr} ${end.period}`
}

// A single clock time sized for a grid column header. Two economies, both deliberate:
// `:00` is dropped from whole hours because it is ~45% of the label's width and carries nothing,
// and the period marker is a bare `a`/`p` rather than ` AM`/` PM`. Together they make `9a`
// narrower than the `9:00` it replaces, which is what pays for showing the marker on every
// column (see buildGridSlotLabels). formatMinuteOfDay keeps the full form for prose.
//
// Deliberately NOT `Noon`/`Midnight`: on a row labelled `Tue Jul 28`, a first column reading
// `Midnight` is 00:00 Tuesday while a final column reading `11p–Midnight` is 00:00 Wednesday —
// one word, one row, 24 hours apart. `12a`/`12p` inherit the ordinary grid convention that a
// clock time belongs to its row's date.
// Minutes past the end of a day (1440, a dates-only poll's implicit slot end) need no handling
// here: toClockParts already wraps them into the day.
export function formatGridTime(minute: number, showPeriod: boolean): string {
  const { hour12, minute: minuteOfHour, period } = toClockParts(minute)
  const base = minuteOfHour === 0 ? `${hour12}` : `${hour12}:${String(minuteOfHour).padStart(2, '0')}`
  return showPeriod ? `${base}${period === 'AM' ? 'a' : 'p'}` : base
}

// Whether every slot spans the same number of minutes. Two different consumers need this and must
// not disagree: buildGridSlotLabels drops the final column's end time only when it holds, and
// formatSlotDuration states the cadence above the grid only when it holds. Keeping it a predicate
// — rather than inferring it from formatSlotDuration returning a string — stops a copy change from
// silently altering what the headers show.
export function hasUniformDuration(columns: { startMinute: number; endMinute: number }[]): boolean {
  const first = columns[0]
  if (!first) return false
  const duration = first.endMinute - first.startMinute
  return columns.every((column) => column.endMinute - column.startMinute === duration)
}

// The cadence line shown once above the grid, which is what lets every contiguous column — and
// the final one — show only its start time. Returns undefined when durations vary, because no
// single line can state them; buildGridSlotLabels then keeps the range on the final column so
// the information isn't lost. A zero-length column is also unstatable — `a 0-hour slot` is worse
// than silence — so it too returns undefined.
//
// A full sentence, not the bare `1-hour slots` fragment this used to return: it is the only thing
// on the page that says how long a slot is once the headers drop their end times, and naming the
// column is what connects it to the row of headers it explains.
export function formatSlotDuration(columns: { startMinute: number; endMinute: number }[]): string | undefined {
  if (!hasUniformDuration(columns)) return undefined
  const duration = columns[0].endMinute - columns[0].startMinute
  if (duration <= 0) return undefined
  if (duration % 60 === 0) return `Each column is a ${duration / 60}-hour slot.`
  return `Each column is a ${duration}-minute slot.`
}
