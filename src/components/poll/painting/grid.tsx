import { Check } from 'lucide-react'
import React, { useRef } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'
import { usePaintGesture } from '@hooks/usePaintGesture'
import { AvailabilityCell, Slot } from '@types'
import { formatShortDate } from '@utils/dates'

export interface PaintGridProps {
  dates: string[]
  slots: Slot[]
  slotLabels: string[]
  grid: boolean[][]
  onCommit: (cells: AvailabilityCell[]) => void
}

interface CellCoords {
  dateIndex: number
  slotIndex: number
}

function cellCoordsFromElement(el: Element | null | undefined): CellCoords | null {
  const button = el?.closest<HTMLElement>('[data-date-index]')
  if (!button) return null
  const dateIndex = Number(button.dataset.dateIndex)
  const slotIndex = Number(button.dataset.slotIndex)
  if (Number.isNaN(dateIndex) || Number.isNaN(slotIndex)) return null
  return { dateIndex, slotIndex }
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

function cellLabel(dateLabel: string, slotLabel: string | undefined, showSlotLabel: boolean): string {
  if (!showSlotLabel || !slotLabel) return dateLabel
  return `${dateLabel}, ${slotLabel}`
}

const PaintGrid = ({ dates, slots, slotLabels, grid, onCommit }: PaintGridProps): React.ReactNode => {
  const gesture = usePaintGesture(grid, onCommit)
  const activePointerId = useRef<number | null>(null)
  const lastCellKey = useRef<string | null>(null)
  // A dates-only poll (`poll.usesTimes === false`) always has exactly one implicit all-day slot
  // (see `Slot`/`PollData` in types.ts) — there's nothing meaningful to put in a header column
  // for it, so the grid collapses to a plain per-date toggle list with no header row at all.
  // This is a presentational branch only; the cell grid itself is always `dates × slots`,
  // dates-only or not. The caller populates `slotLabels` with one entry per slot exactly when
  // `slots.length > 1`, and `[]` otherwise, so this check is equivalent to the old
  // `slots.length > 1` rule.
  const showSlotHeader = slotLabels.length > 0

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
    lastCellKey.current = `${cell.dateIndex}:${cell.slotIndex}`
    gesture.startPaint(cell.dateIndex, cell.slotIndex)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    if (activePointerId.current !== event.pointerId) return
    const cell = cellCoordsAt(event.clientX, event.clientY, event.target)
    if (!cell) return
    const cellKey = `${cell.dateIndex}:${cell.slotIndex}`
    if (cellKey === lastCellKey.current) return
    lastCellKey.current = cellKey
    gesture.continuePaint(cell.dateIndex, cell.slotIndex)
  }

  return (
    // `position: sticky` only pins against the nearest *actual* scroll container — a plain
    // `overflow-x-auto` div with no height bound never becomes one (its content just grows the
    // box instead of overflowing it), so the sticky header/date-label cells below would silently
    // do nothing. Bounding the height and scrolling both axes on this one element makes it a
    // real scrollport, which both the horizontal slot-column scroll and the sticky pinning
    // legitimately need — the trade-off is a capped-height panel with its own scrollbar once a
    // poll has enough dates to exceed it, rather than the whole page scrolling arbitrarily far.
    <div
      className="max-h-[32rem] overflow-auto"
      onPointerCancel={stopGesture}
      onPointerDown={handlePointerDown}
      onPointerLeave={stopGesture}
      onPointerMove={handlePointerMove}
      onPointerUp={stopGesture}
      // Without this, dragging a finger across the grid is interpreted as a page pan/scroll —
      // the browser fires `pointercancel` mid-gesture instead of delivering `pointermove`.
      style={{ touchAction: 'none' }}
    >
      <div className="grid gap-1" style={{ gridTemplateColumns: `6rem repeat(${slots.length}, minmax(3.5rem, 1fr))` }}>
        {showSlotHeader && (
          <>
            <div className="sticky left-0 top-0 z-10 bg-[var(--ink)]" />
            {slots.map((slot, index) => (
              <div className="sticky top-0 z-10 bg-[var(--ink)] text-center text-xs font-semibold" key={slot.slotIndex}>
                {slotLabels[index]}
              </div>
            ))}
          </>
        )}
        {dates.map((date, dateIndex) => {
          const dateLabel = formatShortDate(date)
          return (
            <React.Fragment key={date}>
              <div className="sticky left-0 z-10 bg-[var(--ink)] text-right text-xs text-[var(--slate)]">
                {dateLabel}
              </div>
              {slots.map((slot, index) => {
                const on = gesture.isOn(dateIndex, slot.slotIndex)
                return (
                  <button
                    aria-label={cellLabel(dateLabel, slotLabels[index], showSlotHeader)}
                    aria-pressed={on}
                    className={`flex h-8 items-center justify-center rounded transition-colors duration-150 ease-out ${FOCUS_RING} ${
                      on ? 'bg-[var(--accent)]' : 'bg-[var(--bone)]/10'
                    }`}
                    data-date-index={dateIndex}
                    data-slot-index={slot.slotIndex}
                    key={slot.slotIndex}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return
                      // Prevent the browser's native synthesized click for Enter/Space so it can't
                      // fire a second, redundant toggle on top of the one below.
                      e.preventDefault()
                      gesture.startPaint(dateIndex, slot.slotIndex)
                      gesture.endPaint()
                    }}
                    type="button"
                  >
                    {/* aria-pressed already covers screen readers; this icon gives sighted
                        low-vision/colorblind users a non-color cue for the "on" state too. */}
                    {on && <Check aria-hidden="true" className="h-4 w-4 text-[var(--ink)]/70" />}
                  </button>
                )
              })}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}

export default PaintGrid
