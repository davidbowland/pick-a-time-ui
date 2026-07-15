export function detectViewerTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone
}
