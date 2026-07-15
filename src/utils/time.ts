function formatClock(minute: number): { hour12: number; minuteStr: string; period: 'AM' | 'PM' } {
  const normalized = ((minute % 1440) + 1440) % 1440
  const totalHour = Math.floor(normalized / 60)
  const minuteOfHour = normalized % 60
  const period = totalHour < 12 ? 'AM' : 'PM'
  const hour12 = totalHour % 12 === 0 ? 12 : totalHour % 12
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
