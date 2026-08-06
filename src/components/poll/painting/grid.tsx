import { Check } from 'lucide-react'
import React, { useMemo, useRef } from 'react'

import { GridColumns } from '../grid-columns'
import { ScrollEdgeIndicators } from '../scroll-edge-indicators'
import { DISABLED_CELL_CLASS, TimeWindow, findCellForColumn, gridLayout, showsDateColumn } from '../slot-columns'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { useInitialColumnScroll } from '@hooks/useInitialColumnScroll'
import { usePaintGesture } from '@hooks/usePaintGesture'
import { useScrollEdges } from '@hooks/useScrollEdges'
import { AvailabilityCell, Slot } from '@types'
import { buildGridDateLabels } from '@utils/dates'
import { GridSlotLabel } from '@utils/timezone'

export interface PaintGridProps {
  dates: string[]
  // What every cell is *named*: the full comma'd date from formatShortDate, one per date. Separate
  // from the visible row labels for the same reason slotAriaLabels is separate from slotLabels —
  // buildGridDateLabels repeats the month only when it changes, which reads fine in a column
  // scanned top to bottom and badly as the out-of-context announcement for a single cell.
  dateAriaLabels: string[]
  slots: Slot[][]
  columns: TimeWindow[]
  // What the header *shows*: abbreviated, series-aware, sized for a 3rem column (48px at a 16px root).
  slotLabels: GridSlotLabel[]
  // What the header and every cell are *named*: the full unabbreviated range, including the
  // day-offset wording. Kept as a separate parallel array so shortening the visible label can
  // never shorten what a screen reader announces.
  slotAriaLabels: string[]
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

// Deliberately built from the long forms of both halves, never from what the headers display: a
// cell is the only place a screen reader hears the date or the time at all when the user tabs
// straight into the grid, and on a single-date poll there is no row header to fall back on.
function cellLabel(dateAriaLabel: string, slotAriaLabel: string | undefined): string {
  if (!slotAriaLabel) return dateAriaLabel
  return `${dateAriaLabel}, ${slotAriaLabel}`
}

const PaintGrid = ({
  dates,
  dateAriaLabels,
  slots,
  columns,
  slotLabels,
  slotAriaLabels,
  grid,
  onCommit,
}: PaintGridProps): React.ReactNode => {
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

  const dateLabels = useMemo(() => buildGridDateLabels(dates), [dates])
  // A single-date poll states its date above the grid instead (painting/index.tsx), reclaiming the
  // whole sticky column for the poll type where every other column is a time slot. This value and
  // the two `{hasLabelColumn && ...}` guards below are one indivisible unit: gridLayout must
  // describe the columns the table ACTUALLY renders, so claiming `false` while a <th> still
  // rendered would declare N columns in the colgroup against N+1 real ones — the label column
  // would lose its fixed width and divide evenly with the slots, and min-width would come up 5rem
  // (80px at a 16px root) short, enough for a many-slot single-date poll on a phone to fall under
  // the 24x24 AA target minimum. Style assertions are barred, so no test could catch it. Never
  // change one alone.
  const hasLabelColumn = showsDateColumn(dates.length)
  // One call, never gridMinWidth and GridColumns separately: the colgroup gives the slot columns
  // no width at all (that is what makes fixed layout share leftover space equally), so the entire
  // 24x24 target-size floor lives in the table's min-width. Derived apart, the two could drift and
  // nothing would fail — style assertions are barred, so no test can catch it.
  const layout = gridLayout(columns.length, hasLabelColumn)

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
  const scrollEdges = useScrollEdges(containerRef, columns.length + dates.length)

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
    <div className="relative">
      <ScrollEdgeIndicators edges={scrollEdges} />
      {/* `position: sticky` only pins against the nearest *actual* scroll container — a plain
      `overflow-x-auto` div with no height bound never becomes one (its content just grows the
      box instead of overflowing it), so the sticky header/date-label cells below would silently
      do nothing. Bounding the height and scrolling both axes on this one element makes it a
      real scrollport, which both the horizontal slot-column scroll and the sticky pinning
      legitimately need — the trade-off is a capped-height panel with its own scrollbar once a
      poll has enough dates to exceed it, rather than the whole page scrolling arbitrarily far.

      This is a real <table>, not a `display: grid` of divs, because `position: sticky` applied
      directly to a grid item loses its stuck position once horizontal scroll nears the end of
      the scrollable range — reproduced in a real browser against this exact
      column/gap/sticky/overflow-auto combination. Sticky `<th>` cells in a table don't have that
      failure mode; it's the standard pattern for frozen table headers/columns. The drag-paint
      gesture below is untouched by this — it hit-tests via `elementFromPoint` and reads
      `data-date-index`/`data-slot-index` off whichever button is under the pointer, neither of
      which cares what the button's ancestor markup is. */}
      <div
        className="max-h-[32rem] overflow-auto"
        onPointerCancel={stopGesture}
        onPointerDown={handlePointerDown}
        onPointerLeave={stopGesture}
        onPointerMove={handlePointerMove}
        onPointerUp={stopGesture}
        ref={containerRef}
      >
        <table className="w-full table-fixed border-separate border-spacing-1" style={layout.tableStyle}>
          <GridColumns {...layout.colgroupProps} />
          {showSlotHeader && (
            <thead>
              <tr>
                {hasLabelColumn && <th className="sticky top-0 left-0 z-10 bg-[var(--ink)]" data-scroll-label />}
                {columns.map((column, index) => (
                  <th
                    // A `<th scope="col">`'s own text is announced during table navigation, so
                    // without this a screen reader reads the abbreviation verbatim — `9a`. The
                    // full range, day-offset wording included, stays here.
                    aria-label={slotAriaLabels[index]}
                    // whitespace-nowrap so a gap column's `9a–10` range can't wrap the sticky
                    // header band to two lines while every neighboring header stays on one.
                    // overflow-hidden text-ellipsis for the case that leaves: a range label such
                    // as `11:30a–1p` is wider than the 3rem (48px at a 16px root) this column is
                    // budgeted, and the next header is opaque and at the same z-index, so it would
                    // paint over the spill and slice the label mid-glyph. The ellipsis makes that
                    // degrade legibly. The accessible name is unaffected — the full range lives in
                    // aria-label above — so this is a purely visual clamp.
                    className="sticky top-0 z-10 overflow-hidden bg-[var(--ink)] p-0 text-center text-xs font-semibold text-ellipsis whitespace-nowrap"
                    data-scroll-column
                    key={`${column.startMinute}-${column.endMinute}`}
                    scope="col"
                  >
                    {slotLabels[index]?.label}
                    {/* `?.` and `?? 0` are belt and braces, not a guard against any state this app
                      can reach: painting/index.tsx keeps slotLabels parallel to columns whenever it
                      is non-empty, and when it is empty `showSlotHeader` is false and this whole
                      <thead> never renders. What they do buy is a direct consumer — a test, say —
                      passing shorter arrays than `columns`, where the naive `!== 0` check would
                      pass on `undefined` and then throw dereferencing .dayOffset. aria-hidden
                      because the same fact is already spelled out in this header's aria-label and
                      in every cell's — a bare `+1` read aloud is noise. */}
                    {(slotLabels[index]?.dayOffset ?? 0) !== 0 && (
                      <sup aria-hidden="true" className="ml-0.5 text-[0.625rem] text-[var(--slate)]">
                        {(slotLabels[index]?.dayOffset ?? 0) > 0 ? '+1' : '−1'}
                      </sup>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {dates.map((date, dateIndex) => {
              const dateLabel = dateLabels[dateIndex]
              const dateAriaLabel = dateAriaLabels[dateIndex]
              const dateSlots = slots[dateIndex] ?? []
              return (
                <tr key={date}>
                  {hasLabelColumn && (
                    <th
                      // A `<th scope="row">`'s own text is announced during table navigation, the
                      // same way a `<th scope="col">`'s is, so without this a row after a month
                      // change announces `Wed 29` — a date with no month in it. The full comma'd
                      // form stays here; the abbreviation stays a purely visual economy.
                      aria-label={dateAriaLabel}
                      // pr-2 pl-1 is exactly the 0.75rem (12px at a 16px root) of padding
                      // GRID_LABEL_WIDTH (5.25rem) assumes.
                      // Widen it and the widest label — `Wed May 28`, see slot-columns.ts — no
                      // longer fits, and because this cell is whitespace-nowrap text-right the
                      // overflow spills LEFT out of the scrollport rather than clipping visibly,
                      // which is easy to miss and hard to attribute.
                      className="sticky left-0 z-10 bg-[var(--ink)] py-0 pr-2 pl-1 text-right text-xs font-normal whitespace-nowrap text-[var(--slate)]"
                      scope="row"
                    >
                      {dateLabel}
                    </th>
                  )}
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
                        {/* touch-none lives on the cell button itself, not the scrollport: a touch that
                          starts on a cell paints (and the browser won't hijack it into a page/grid
                          scroll mid-drag), while a touch starting on the sticky date/time-label
                          headers — which aren't buttons — keeps its default touch-action and scrolls
                          the grid normally. */}
                        <button
                          aria-label={cellLabel(dateAriaLabel, slotAriaLabels[index])}
                          aria-pressed={on}
                          className={`flex h-8 w-full touch-none items-center justify-center rounded transition-colors duration-150 ease-out ${FOCUS_RING} ${
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
    </div>
  )
}

export default PaintGrid
