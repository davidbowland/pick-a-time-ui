import { formatMinuteOfDay } from './time'
import { getZonedComponents } from './timezone'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function toIsoDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  date.setDate(date.getDate() + days)
  return toIsoDate(date)
}

export function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return `${DAY_NAMES[date.getDay()]}, ${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`
}

export function formatExpiration(expirationSeconds: number, timeZone: string): string {
  const { date, minuteOfDay } = getZonedComponents(expirationSeconds * 1000, timeZone)
  const [year, month, day] = date.split('-').map(Number)
  return `Closes ${MONTH_NAMES[month - 1]} ${day}, ${year} at ${formatMinuteOfDay(minuteOfDay)}`
}

const plural = (count: number, unit: string): string => `${count} ${unit}${count === 1 ? '' : 's'} ago`

// `now` is injected so the calendar strip's timestamp is assertable without touching the wall clock.
export const formatCheckedAgo = (epochSeconds: number, now: () => number = Date.now): string => {
  const seconds = Math.floor(now() / 1000) - epochSeconds
  if (seconds < 60) {
    return 'just now'
  }
  if (seconds < 3600) {
    return plural(Math.floor(seconds / 60), 'minute')
  }
  if (seconds < 86_400) {
    return plural(Math.floor(seconds / 3600), 'hour')
  }
  return plural(Math.floor(seconds / 86_400), 'day')
}

export function isWeekendDate(iso: string, timezone: string): boolean {
  const [y, m, d] = iso.split('-').map(Number)
  // Date.UTC, not `new Date(y, m-1, d, 12)` — the latter interprets "noon" in the *host
  // machine's* local timezone, not UTC, so the ±12h safety margin this anchor is supposed to
  // provide would actually be measured against the wrong reference point whenever `timezone`
  // differs from the runtime's own zone (exactly the common case for this function). Anchoring
  // to UTC matches the same pattern src/utils/timezone.ts's zonedToUtcMs already uses.
  const noon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const weekday = new Intl.DateTimeFormat(undefined, { timeZone: timezone, weekday: 'short' }).format(noon)
  return weekday === 'Sat' || weekday === 'Sun'
}

// Grid row labels, shortened for a phone-width sticky column. The weekday is the token people
// navigate by — nobody infers "Wednesday" from "Jul 29" — so it always stays and the month is
// what becomes conditional. Year and month are compared together so a poll spanning a full year
// doesn't silently hide a month change. Deliberately not `formatShortDate`, which keeps its
// longer comma'd form for prose (see results/elements.tsx).
export function buildGridDateLabels(dates: string[]): string[] {
  return dates.map((iso, index) => {
    const [y, m, d] = iso.split('-').map(Number)
    const dayName = DAY_NAMES[new Date(y, m - 1, d).getDay()]
    const [previousYear, previousMonth] = (dates[index - 1] ?? '').split('-').map(Number)
    const sameMonth = y === previousYear && m === previousMonth
    return sameMonth ? `${dayName} ${d}` : `${dayName} ${MONTH_NAMES[m - 1]} ${d}`
  })
}
