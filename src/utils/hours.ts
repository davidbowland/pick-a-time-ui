const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const

export function isClosedToday(openHours: string[], now = (): Date => new Date()): boolean {
  const dayName = DAY_NAMES[now().getDay()]
  const todayEntry = openHours.find((h) => h.startsWith(dayName))
  if (!todayEntry) return false
  return todayEntry.toLowerCase().includes('closed')
}

export function getTodayHours(openHours: string[], now = (): Date => new Date()): string | null {
  const dayName = DAY_NAMES[now().getDay()]
  const entry = openHours.find((h) => h.startsWith(dayName))
  if (!entry) return null
  const hours = entry.substring(entry.indexOf(': ') + 2)
  if (hours.toLowerCase().includes('closed')) return null
  return hours
}
