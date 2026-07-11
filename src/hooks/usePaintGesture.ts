import { useCallback, useRef, useState } from 'react'

import { AvailabilityCell } from '@types'

export interface PaintGesture {
  isOn: (hourIndex: number, dayIndex: number) => boolean
  startPaint: (hourIndex: number, dayIndex: number) => void
  continuePaint: (hourIndex: number, dayIndex: number) => void
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

  const key = (h: number, d: number): string => `${h}:${d}`

  const isOn = useCallback(
    (hourIndex: number, dayIndex: number): boolean => {
      const k = key(hourIndex, dayIndex)
      return overlay.has(k) ? (overlay.get(k) as boolean) : baseGrid[hourIndex][dayIndex]
    },
    [overlay, baseGrid],
  )

  const paintCell = useCallback((hourIndex: number, dayIndex: number, value: boolean) => {
    const next = new Map(overlayRef.current)
    next.set(key(hourIndex, dayIndex), value)
    overlayRef.current = next
    setOverlay(next)
  }, [])

  const startPaint = useCallback(
    (hourIndex: number, dayIndex: number) => {
      paintingRef.current = true
      paintValueRef.current = !baseGrid[hourIndex][dayIndex]
      paintCell(hourIndex, dayIndex, paintValueRef.current)
    },
    [baseGrid, paintCell],
  )

  const continuePaint = useCallback(
    (hourIndex: number, dayIndex: number) => {
      if (!paintingRef.current) return
      paintCell(hourIndex, dayIndex, paintValueRef.current)
    },
    [paintCell],
  )

  const endPaint = useCallback(() => {
    paintingRef.current = false
    const finalOverlay = overlayRef.current
    if (finalOverlay.size === 0) return
    const cells: AvailabilityCell[] = Array.from(finalOverlay.entries()).map(([k, value]) => {
      const [hourIndex, dayIndex] = k.split(':').map(Number)
      return { hourIndex, dayIndex, value }
    })
    onCommit(cells)
    overlayRef.current = new Map()
    setOverlay(overlayRef.current)
  }, [onCommit])

  return { isOn, startPaint, continuePaint, endPaint }
}
