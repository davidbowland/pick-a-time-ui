import { useCallback, useEffect, useRef } from 'react'

import { AvailabilityCell } from '@types'

const cellKey = (cell: AvailabilityCell): string => `${cell.dateIndex}:${cell.slotIndex}`

// Coalesces cells from calls that land close together in time (e.g. several quick individual
// clicks) into a single flush, so they produce one PATCH instead of one per click. A single
// drag already commits its cells in one call via usePaintGesture's endPaint, so it flushes on
// its own timer tick without waiting on anything else.
export function useDebouncedAvailabilityCommit(
  onFlush: (cells: AvailabilityCell[]) => void,
  delayMs: number,
): (cells: AvailabilityCell[]) => void {
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

  const flush = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = undefined
    const cells = Array.from(pendingRef.current.values())
    pendingRef.current = new Map()
    if (cells.length > 0) onFlushRef.current(cells)
  }, [])

  useEffect(() => () => flush(), [flush])

  return useCallback(
    (cells: AvailabilityCell[]) => {
      for (const cell of cells) pendingRef.current.set(cellKey(cell), cell)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(flush, delayMs)
    },
    [flush, delayMs],
  )
}
