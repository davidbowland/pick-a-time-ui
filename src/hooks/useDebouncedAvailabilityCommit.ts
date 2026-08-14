import { useCallback, useEffect, useRef } from 'react'

import { AvailabilityCell } from '@types'

const cellKey = (cell: AvailabilityCell): string => `${cell.dateIndex}:${cell.slotIndex}`

// Coalesces cells from calls that land close together in time (e.g. several quick individual
// clicks) into a single flush, so they produce one PATCH instead of one per click. A single
// drag already commits its cells in one call via usePaintGesture's endPaint, so it flushes on
// its own timer tick without waiting on anything else.
export function useDebouncedAvailabilityCommit(
  onFlush: (cells: AvailabilityCell[]) => void | Promise<void>,
  delayMs: number,
): { commit: (cells: AvailabilityCell[]) => void; flush: () => Promise<void> } {
  const pendingRef = useRef<Map<string, AvailabilityCell>>(new Map())
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Callers (e.g. PaintingPhase) pass an inline, non-memoized onFlush that gets a new identity on
  // every render — including the render triggered by the very click that just queued a cell.
  // Reading it through a ref, rather than depending on it directly, keeps `flush` itself stable
  // so the unmount-flush effect below doesn't tear down and fire early on every re-render.
  const onFlushRef = useRef(onFlush)
  useEffect(() => {
    onFlushRef.current = onFlush
  })

  // Awaited, not fire-and-forget: a calendar check that drains this queue has to know the drained
  // cells actually reached the server before it reads them back. Returning the onFlush result is
  // what lets `flush()` mean "these cells have landed" rather than "these cells have been sent".
  const flush = useCallback(async (): Promise<void> => {
    clearTimeout(timerRef.current)
    timerRef.current = undefined
    const cells = Array.from(pendingRef.current.values())
    pendingRef.current = new Map()
    if (cells.length > 0) await onFlushRef.current(cells)
  }, [])

  useEffect(() => () => void flush(), [flush])

  const commit = useCallback(
    (cells: AvailabilityCell[]) => {
      for (const cell of cells) pendingRef.current.set(cellKey(cell), cell)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, delayMs)
    },
    [flush, delayMs],
  )

  // `flush` is exposed so a calendar check can drain pending paints before it overwrites the
  // record server-side; without it a check landing mid-batch discards up to `delayMs` of painting.
  return { commit, flush }
}
