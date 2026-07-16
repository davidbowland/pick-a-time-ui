import { Check } from 'lucide-react'
import React, { useMemo, useRef } from 'react'

import { DISABLED_CELL_CLASS, TimeWindow, findCellForColumn } from '../slot-columns'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { useInitialColumnScroll } from '@hooks/useInitialColumnScroll'
import { usePaintGesture } from '@hooks/usePaintGesture'
import { AvailabilityCell, Slot } from '@types'
import { formatShortDate } from '@utils/dates'

export interface PaintGridProps {
  dates: string[]
  slots: Slot[][]
  columns: TimeWindow[]
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

const PaintGrid = ({ dates, slots, columns, slotLabels, grid, onCommit }: PaintGridProps): React.ReactNode => {
  const gesture = usePaintGesture(grid, onCommit)
  const activePointerId = useRef<number | null>(null)
  const lastCellKey = useRef<string | null>(null)
  // A dates-only poll (`poll.usesTimes === false`) always has exactly one implicit all-day slot
  // (see `Slot`/`PollData` in types.ts) — there's nothing meaningful to put in a header column
  // for it, so the grid collapses to a plain per-date toggle list with no header row at all.
  // This is a presentational branch only; the cell grid itself is always `dates × columns`,
  // dates-only or not. The caller populates `slotLabels` with one entry per union column exactly
  // when `columns.length > 1`, and `[]` otherwise, so this check is equivalent to that rule.
  const showSlotHeader = slotLabels.length > 0

  const containerRef = useRef<HTMLDivElement>(null)
  // A column's score is how many dates have an actionable (non-disabled) cell for it — not how
  // many are checked. The scroll should land on the window with the most real buttons to act on,
  // not the window that happens to already be painted.
  const scores = useMemo(
    () =>
      columns.map((column) =>
        dates.reduce((count, _date, dateIndex) => {
          const slot = findCellForColumn(slots[dateIndex] ?? [], column)
          return slot ? count + 1 : count
        }, 0),
      ),
    [columns, dates, slots],
  )
  useInitialColumnScroll(containerRef, columns.length, scores)

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
    //
    // This is a real <table>, not a `display: grid` of divs, because `position: sticky` applied
    // directly to a grid item loses its stuck position once horizontal scroll nears the end of
    // the scrollable range — reproduced in a real browser against this exact
    // column/gap/sticky/overflow-auto combination. Sticky `<th>` cells in a table don't have that
    // failure mode; it's the standard pattern for frozen table headers/columns. The drag-paint
    // gesture below is untouched by this — it hit-tests via `elementFromPoint` and reads
    // `data-date-index`/`data-slot-index` off whichever button is under the pointer, neither of
    // which cares what the button's ancestor markup is.
    <div
      className="max-h-[32rem] overflow-auto"
      onPointerCancel={stopGesture}
      onPointerDown={handlePointerDown}
      onPointerLeave={stopGesture}
      onPointerMove={handlePointerMove}
      onPointerUp={stopGesture}
      ref={containerRef}
      // Without this, dragging a finger across the grid is interpreted as a page pan/scroll —
      // the browser fires `pointercancel` mid-gesture instead of delivering `pointermove`.
      style={{ touchAction: 'none' }}
    >
      <table className="w-full border-separate border-spacing-1">
        {showSlotHeader && (
          <thead>
            <tr>
              <th className="sticky left-0 top-0 z-10 min-w-24 bg-[var(--ink)]" data-scroll-label />
              {columns.map((column, index) => (
                <th
                  className="sticky top-0 z-10 min-w-20 bg-[var(--ink)] p-0 text-center text-xs font-semibold"
                  data-scroll-column
                  key={`${column.startMinute}-${column.endMinute}`}
                  scope="col"
                >
                  {slotLabels[index]}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {dates.map((date, dateIndex) => {
            const dateLabel = formatShortDate(date)
            const dateSlots = slots[dateIndex] ?? []
            return (
              <tr key={date}>
                <th
                  className="sticky left-0 z-10 min-w-24 bg-[var(--ink)] py-0 pr-3 pl-0 text-right text-xs font-normal text-[var(--slate)]"
                  scope="row"
                >
                  {dateLabel}
                </th>
                {columns.map((column, index) => {
                  const slot = findCellForColumn(dateSlots, column)
                  if (!slot) {
                    return (
                      <td className="p-0" key={`${column.startMinute}-${column.endMinute}`}>
                        <div aria-hidden="true" className={`${DISABLED_CELL_CLASS} w-full`} />
                      </td>
                    )
                  }
                  const on = gesture.isOn(dateIndex, slot.slotIndex)
                  return (
                    <td className="p-0" key={slot.slotIndex}>
                      <button
                        aria-label={cellLabel(dateLabel, slotLabels[index], showSlotHeader)}
                        aria-pressed={on}
                        className={`flex h-8 w-full items-center justify-center rounded transition-colors duration-150 ease-out ${FOCUS_RING} ${
                          on ? 'bg-[var(--accent)]' : 'bg-[var(--bone)]/10'
                        }`}
                        data-date-index={dateIndex}
                        data-slot-index={slot.slotIndex}
                        onKeyDown={(e) => {
                          if (e.key !== 'Enter' && e.key !== ' ') return
                          e.preventDefault()
                          gesture.startPaint(dateIndex, slot.slotIndex)
                          gesture.endPaint()
                        }}
                        type="button"
                      >
                        {on && <Check aria-hidden="true" className="h-4 w-4 text-[var(--ink)]/70" />}
                      </button>
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default PaintGrid
