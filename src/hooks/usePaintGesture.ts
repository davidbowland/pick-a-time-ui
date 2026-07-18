import { useCallback, useRef, useState } from 'react'

import { AvailabilityCell } from '@types'

export interface PaintGesture {
  isOn: (dateIndex: number, slotIndex: number) => boolean
  startPaint: (dateIndex: number, slotIndex: number) => void
  continuePaint: (dateIndex: number, slotIndex: number) => void
  endPaint: () => void
}

export function usePaintGesture(baseGrid: boolean[][], onCommit: (cells: AvailabilityCell[]) => void): PaintGesture {
  const [overlay, setOverlay] = useState<Map<string, boolean>>(new Map())
  // Mirrors `overlay` synchronously. `startPaint`/`continuePaint`/`endPaint` can all be invoked
  // within the same event/act batch, before React re-renders and refreshes the `overlay` closure
  // below — `endPaint` reads this ref instead so it always sees the latest painted cells.
  const overlayRef = useRef<Map<string, boolean>>(overlay)
  const paintValueRef = useRef(true)
  const paintingRef = useRef(false)

  const key = (dateIndex: number, slotIndex: number): string => `${dateIndex}:${slotIndex}`

  const isOn = useCallback(
    (dateIndex: number, slotIndex: number): boolean => {
      const k = key(dateIndex, slotIndex)
      return overlay.has(k) ? (overlay.get(k) as boolean) : baseGrid[dateIndex][slotIndex]
    },
    [overlay, baseGrid],
  )

  const paintCell = useCallback((dateIndex: number, slotIndex: number, value: boolean) => {
    const next = new Map(overlayRef.current)
    next.set(key(dateIndex, slotIndex), value)
    overlayRef.current = next
    setOverlay(next)
  }, [])

  const startPaint = useCallback(
    (dateIndex: number, slotIndex: number) => {
      paintingRef.current = true
      paintValueRef.current = !baseGrid[dateIndex][slotIndex]
      paintCell(dateIndex, slotIndex, paintValueRef.current)
    },
    [baseGrid, paintCell],
  )

  const continuePaint = useCallback(
    (dateIndex: number, slotIndex: number) => {
      if (!paintingRef.current) return
      paintCell(dateIndex, slotIndex, paintValueRef.current)
    },
    [paintCell],
  )

  const endPaint = useCallback(() => {
    paintingRef.current = false
    const finalOverlay = overlayRef.current
    if (finalOverlay.size === 0) return
    const cells: AvailabilityCell[] = Array.from(finalOverlay.entries()).map(([k, value]) => {
      const [dateIndex, slotIndex] = k.split(':').map(Number)
      return { dateIndex, slotIndex, value }
    })
    onCommit(cells)
    // `onCommit` (PaintingPhase's handler) writes the committed cells into the query cache
    // synchronously, but TanStack Query's notifyManager schedules the resulting re-render via
    // `setTimeout(fn, 0)` internally — a real macrotask, not a microtask. Clearing the overlay
    // synchronously, right here, would render (and could paint) a beat where the overlay's gone
    // but the caller's underlying grid hasn't caught up yet, flashing the pre-drag state before
    // snapping back. Deferring via the same style of task lets that scheduled update land first.
    setTimeout(() => {
      overlayRef.current = new Map()
      setOverlay(overlayRef.current)
    }, 0)
  }, [onCommit])

  return { isOn, startPaint, continuePaint, endPaint }
}
