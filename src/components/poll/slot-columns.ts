export interface TimeWindow {
  startMinute: number
  endMinute: number
}

// Cells rendered where a date's own slots don't include a given union column — muted, no fill,
// not a button, so it's excluded from tab order and (for the paint-drag gesture in
// painting/grid.tsx) from pointer hit-testing, since it carries no data-date-index/data-slot-index.
export const DISABLED_CELL_CLASS =
  'flex h-8 items-center justify-center rounded border border-dashed border-[var(--hair)] bg-[var(--bone)]/[0.03] cursor-not-allowed'

export function buildUnionColumns(rows: TimeWindow[][]): TimeWindow[] {
  const byKey = new Map<string, TimeWindow>()
  for (const row of rows) {
    for (const window of row) {
      byKey.set(`${window.startMinute}-${window.endMinute}`, {
        startMinute: window.startMinute,
        endMinute: window.endMinute,
      })
    }
  }
  return [...byKey.values()].sort((a, b) => a.startMinute - b.startMinute || a.endMinute - b.endMinute)
}

// Assumes `rowCells` and `column` were both derived from the same server-side slot
// computation (e.g. a poll's `slots` and a matching overlap response's `cells`) — a
// mismatch here fails silently, rendering a real slot as a disabled placeholder.
export function findCellForColumn<T extends TimeWindow>(rowCells: T[], column: TimeWindow): T | undefined {
  return rowCells.find((cell) => cell.startMinute === column.startMinute && cell.endMinute === column.endMinute)
}
