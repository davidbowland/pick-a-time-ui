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
