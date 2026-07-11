import { Check } from 'lucide-react'
import React, { useRef } from 'react'

import { usePaintGesture } from '@hooks/usePaintGesture'
import { AvailabilityCell } from '@types'

export interface PaintGridProps {
  hourLabels: string[]
  dayLabels: string[]
  grid: boolean[][]
  onCommit: (cells: AvailabilityCell[]) => void
}

interface CellCoords {
  hourIndex: number
  dayIndex: number
}

function cellCoordsFromElement(el: Element | null | undefined): CellCoords | null {
  const button = el?.closest<HTMLElement>('[data-hour-index]')
  if (!button) return null
  const hourIndex = Number(button.dataset.hourIndex)
  const dayIndex = Number(button.dataset.dayIndex)
  if (Number.isNaN(hourIndex) || Number.isNaN(dayIndex)) return null
  return { hourIndex, dayIndex }
}

// Resolves the grid cell actually under a pointer's current coordinates rather than trusting
// `event.target`. This matters because touch pointers get *implicit pointer capture* on
// pointerdown: every later event for that touch keeps `target` pinned to the origin element
// even as the finger physically moves over other cells. `elementFromPoint` hit-tests the real
// point and isn't affected by that capture. jsdom has no layout engine and doesn't implement
// `elementFromPoint` at all, so tests fall back to `event.target`, which is exactly correct for
// the mouse-driven tests (no capture involved) and can be explicitly mocked to simulate the
// touch-capture scenario for drag tests.
function cellCoordsAt(x: number, y: number, fallback: EventTarget | null): CellCoords | null {
  const atPoint = typeof document.elementFromPoint === 'function' ? document.elementFromPoint(x, y) : null
  return cellCoordsFromElement(atPoint) ?? cellCoordsFromElement(fallback as Element | null)
}

const PaintGrid = ({ hourLabels, dayLabels, grid, onCommit }: PaintGridProps): React.ReactNode => {
  const gesture = usePaintGesture(grid, onCommit)
  const activePointerId = useRef<number | null>(null)
  const lastCellKey = useRef<string | null>(null)

  const stopGesture = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (activePointerId.current === null || activePointerId.current !== event.pointerId) return
    activePointerId.current = null
    lastCellKey.current = null
    gesture.endPaint()
  }

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    // Release the touch pointer's implicit capture immediately so pointermove below hit-tests
    // normally instead of staying pinned to this origin cell for the rest of the gesture.
    ;(event.target as Element).releasePointerCapture?.(event.pointerId)

    const cell = cellCoordsAt(event.clientX, event.clientY, event.target)
    if (!cell) return
    activePointerId.current = event.pointerId
    lastCellKey.current = `${cell.hourIndex}:${cell.dayIndex}`
    gesture.startPaint(cell.hourIndex, cell.dayIndex)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (activePointerId.current !== event.pointerId) return
    const cell = cellCoordsAt(event.clientX, event.clientY, event.target)
    if (!cell) return
    const cellKey = `${cell.hourIndex}:${cell.dayIndex}`
    if (cellKey === lastCellKey.current) return
    lastCellKey.current = cellKey
    gesture.continuePaint(cell.hourIndex, cell.dayIndex)
  }

  return (
    <div
      className="grid gap-1"
      onPointerCancel={stopGesture}
      onPointerDown={handlePointerDown}
      onPointerLeave={stopGesture}
      onPointerMove={handlePointerMove}
      onPointerUp={stopGesture}
      // Without this, dragging a finger across the grid is interpreted as a page pan/scroll —
      // the browser fires `pointercancel` mid-gesture instead of delivering `pointermove`.
      style={{ gridTemplateColumns: `2.5rem repeat(${dayLabels.length}, 1fr)`, touchAction: 'none' }}
    >
      <div />
      {dayLabels.map((label) => (
        <div className="text-center text-xs font-semibold" key={label}>
          {label}
        </div>
      ))}
      {hourLabels.map((hourLabel, hourIndex) => (
        <React.Fragment key={hourLabel}>
          <div className="text-right text-xs text-[#6B7280]">{hourLabel}</div>
          {dayLabels.map((dayLabel, dayIndex) => {
            const on = gesture.isOn(hourIndex, dayIndex)
            return (
              <button
                aria-label={`${hourLabel}, ${dayLabel}`}
                aria-pressed={on}
                className={`flex h-8 items-center justify-center rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b] ${
                  on ? 'bg-[#F59E0B]' : 'bg-white/10'
                }`}
                data-day-index={dayIndex}
                data-hour-index={hourIndex}
                key={dayIndex}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' && e.key !== ' ') return
                  // Prevent the browser's native synthesized click for Enter/Space so it can't
                  // fire a second, redundant toggle on top of the one below.
                  e.preventDefault()
                  gesture.startPaint(hourIndex, dayIndex)
                  gesture.endPaint()
                }}
                type="button"
              >
                {/* aria-pressed already covers screen readers; this icon gives sighted
                    low-vision/colorblind users a non-color cue for the "on" state too. */}
                {on && <Check aria-hidden="true" className="h-4 w-4 text-black/70" />}
              </button>
            )
          })}
        </React.Fragment>
      ))}
    </div>
  )
}

export default PaintGrid
