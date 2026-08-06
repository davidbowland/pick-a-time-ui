import { PopoverContent, PopoverDialog } from '@heroui/react'
import { Star } from 'lucide-react'
import React, { useMemo, useRef, useState } from 'react'

import { GridColumns } from '../grid-columns'
import { ScrollEdgeIndicators } from '../scroll-edge-indicators'
import { DISABLED_CELL_CLASS, TimeWindow, findCellForColumn, gridLayout, showsDateColumn } from '../slot-columns'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { useInitialColumnScroll } from '@hooks/useInitialColumnScroll'
import { useScrollEdges } from '@hooks/useScrollEdges'
import { OverlapCell, RecommendedMeeting } from '@services/api'
import { User } from '@types'
import { pickAccessibleTextColor } from '@utils/contrast'
import { GridSlotLabel } from '@utils/timezone'
import { displayName } from '@utils/users'

// CSS var name paired with its real hex (matching index.css's dark-theme values exactly) — the
// hex is needed because pickAccessibleTextColor computes against an actual color, not a var
// reference the browser hasn't resolved yet at the point this component's JS runs.
// Ordered darkest (0 free, least available) -> brightest (all free) so "more available" always
// lands on the most visually prominent end of the scale, and can never regress into a
// near-invisible step the way the previous darkest-is-best scale did.
const HEAT_STEPS = [
  { cssVar: '--heat-0', hex: '#287156' },
  { cssVar: '--heat-1', hex: '#38a07a' },
  { cssVar: '--heat-2', hex: '#55c39b' },
  { cssVar: '--heat-3', hex: '#84d4b7' },
  { cssVar: '--heat-4', hex: '#b4e4d3' },
]

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) }
}

function mixChannel(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t)
}

function mixHex(hexA: string, hexB: string, t: number): string {
  const a = hexToRgb(hexA)
  const b = hexToRgb(hexB)
  const toHexByte = (n: number): string => n.toString(16).padStart(2, '0')
  return `#${toHexByte(mixChannel(a.r, b.r, t))}${toHexByte(mixChannel(a.g, b.g, t))}${toHexByte(mixChannel(a.b, b.b, t))}`
}

// Interpolates continuously along the same five reference colors the legend shows, rather than
// snapping to the nearest one — so every distinct free-count gets its own distinct shade instead
// of collapsing onto one of only five buckets (e.g. 2-of-5 and 3-of-5 no longer share a color).
// Verified in heat-grid.test.tsx that contrast against the page background never drops below the
// WCAG 1.4.11 3:1 non-text minimum anywhere along the gradient — it only needs checking at the
// five stops themselves plus the endpoints, since RGB-lerping between two points that already
// clear 3:1 can't dip below it partway between them.
export function heatColorFor(freeCount: number, participantCount: number): string {
  if (participantCount === 0) return HEAT_STEPS[0].hex
  const ratio = Math.min(1, Math.max(0, freeCount / participantCount))
  const scaled = ratio * (HEAT_STEPS.length - 1)
  const lowerIndex = Math.floor(scaled)
  const upperIndex = Math.min(HEAT_STEPS.length - 1, lowerIndex + 1)
  return mixHex(HEAT_STEPS[lowerIndex].hex, HEAT_STEPS[upperIndex].hex, scaled - lowerIndex)
}

export function isRecommendedCell(
  cell: { dateIndex: number; slotIndex: number },
  recommendedMeetings: RecommendedMeeting[],
): boolean {
  return recommendedMeetings.some(
    (meeting) => meeting.dateIndex === cell.dateIndex && meeting.slotIndex === cell.slotIndex,
  )
}

export function isBestSlotCell(
  cell: { dateIndex: number; slotIndex: number },
  bestSlot?: { dateIndex: number; slotIndex: number },
): boolean {
  return !!bestSlot && bestSlot.dateIndex === cell.dateIndex && bestSlot.slotIndex === cell.slotIndex
}

// Mirrors missingUserIds in results/elements.tsx: the viewer is pulled to the front of the list
// so "You" reads as an answer to "am I free then?" rather than being buried mid-list.
export function orderFreeUserIds(freeUserIds: string[], viewerUserId?: string): string[] {
  return viewerUserId !== undefined && freeUserIds.includes(viewerUserId)
    ? [viewerUserId, ...freeUserIds.filter((id) => id !== viewerUserId)]
    : freeUserIds
}

export const HeatGrid = ({
  cells,
  columns,
  dateAriaLabels,
  dateLabels,
  slotAriaLabels,
  slotLabels,
  participantCount,
  recommendedMeetings = [],
  bestSlot,
  users,
  viewerUserId,
}: {
  cells: OverlapCell[][]
  columns: TimeWindow[]
  // What every cell is *named*: the full comma'd date from formatShortDate, one per date. Separate
  // from the visible row labels for the same reason slotAriaLabels is separate from slotLabels —
  // buildGridDateLabels repeats the month only when it changes, which reads fine in a column
  // scanned top to bottom and badly as the out-of-context announcement for a single cell.
  dateAriaLabels: string[]
  dateLabels: string[]
  // What the header and every cell are *named*: the full unabbreviated range, including the
  // day-offset wording. Kept as a separate parallel array so shortening the visible label can
  // never shorten what a screen reader announces.
  slotAriaLabels: string[]
  // What the header *shows*: abbreviated, series-aware, sized for a 3rem column (48px at a 16px root).
  slotLabels: GridSlotLabel[]
  participantCount: number
  recommendedMeetings?: RecommendedMeeting[]
  bestSlot?: { dateIndex: number; slotIndex: number }
  users: User[]
  viewerUserId?: string
}): React.ReactNode => {
  const [selected, setSelected] = useState<OverlapCell | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const isDatesOnly = slotLabels.length === 0
  const columnCount = isDatesOnly ? 1 : columns.length
  // A single-date poll states its date above the grid instead (results/index.tsx), reclaiming the
  // whole sticky column for the poll type where every other column is a time slot. This value and
  // the two `{hasLabelColumn && ...}` guards below are one indivisible unit: gridLayout must
  // describe the columns the table ACTUALLY renders, so claiming `false` while a <th> still
  // rendered would declare N columns in the colgroup against N+1 real ones — the label column
  // would lose its fixed width and divide evenly with the slots, and min-width would come up 5rem
  // (80px at a 16px root) short, enough for a many-slot single-date poll on a phone to fall under
  // the 24x24 AA target minimum. Style assertions are barred, so no test could catch it. Never
  // change one alone.
  // PaintGrid carries the identical local for the identical reason.
  const hasLabelColumn = showsDateColumn(dateLabels.length)
  // One call, never gridMinWidth and GridColumns separately: the colgroup gives the slot columns
  // no width at all (that is what makes fixed layout share leftover space equally), so the entire
  // 24x24 target-size floor lives in the table's min-width. Derived apart, the two could drift and
  // nothing would fail — style assertions are barred, so no test can catch it. `columnCount`, not
  // `columns.length`: a dates-only poll renders one implicit column against an empty `columns`.
  const layout = gridLayout(columnCount, hasLabelColumn)

  const containerRef = useRef<HTMLDivElement>(null)
  // Unlike PaintGrid's actionable-cell scoring, this grid is read-only overlap data — its score
  // is simply how many people are free, so the busiest window is the one with the most overlap.
  const scores = useMemo(
    () =>
      isDatesOnly
        ? []
        : columns.map((column) =>
            dateLabels.reduce(
              (sum, _label, dateIndex) => sum + (findCellForColumn(cells[dateIndex] ?? [], column)?.freeCount ?? 0),
              0,
            ),
          ),
    [cells, columns, dateLabels, isDatesOnly],
  )
  useInitialColumnScroll(containerRef, columnCount, scores)
  const scrollEdges = useScrollEdges(containerRef, columnCount + dateLabels.length)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <ScrollEdgeIndicators edges={scrollEdges} />
        {/* Bounded height + scroll on both axes, matching the painting grid's scroll container
          exactly — `position: sticky` below only pins against an actual scrollport, which a
          plain `overflow-x-auto` div with no height bound never becomes (see painting/grid.tsx
          for the full explanation). Same many-columns scenario applies here (a wide time window
          + 15-minute slots), so the same scroll affordance and sticky headers apply.

          This is a real <table>, not a `display: grid` of divs, because `position: sticky`
          applied directly to a grid item loses its stuck position once horizontal scroll nears
          the end of the scrollable range — reproduced in a real browser against this exact
          column/gap/sticky/overflow-auto combination. Sticky `<th>` cells in a table don't have
          that failure mode; it's the standard pattern for frozen table headers/columns, and it
          gives screen readers real row/column header associations as a side benefit. */}
        <div className="max-h-[32rem] overflow-auto" onScroll={() => setSelected(null)} ref={containerRef}>
          {/* Cell gaps come from td/th padding, NOT border-spacing: spacing gaps are transparent
            holes in the sticky label column/header band, so ring and star fragments scrolled
            beneath them would stay visible through the gaps no matter the z-index. With padding
            the sticky cells' opaque boxes touch, forming a solid band that fully hides whatever
            scrolls under it.

            `border-spacing-0` is what makes that paragraph true rather than merely intended.
            Tailwind preflight sets `border-collapse: collapse` but never touches border-spacing,
            and Tailwind v4's `border-separate` sets only `border-collapse: separate` — so the HTML
            UA stylesheet's `table { border-spacing: 2px }` survived here. That left 2px transparent
            holes in the sticky band this table's padding exists to avoid, and made the real
            inter-cell gap 6px rather than the 4px the width model assumes.

            `table-fixed` replaces auto layout, which sized every column to its own header text and
            let the label column swallow spare width; the <colgroup> supplies the widths instead,
            and applies even on the dates-only path where no <thead> renders. */}
          <table className="w-full table-fixed border-separate border-spacing-0" style={layout.tableStyle}>
            <GridColumns {...layout.colgroupProps} />
            {!isDatesOnly && (
              <thead>
                <tr>
                  {/* Layer ladder for this grid's sticky/overlay pieces, bottom to top:
                    cells + recommended rings (z-auto) < column headers (z-10) < best-slot star
                    (z-20, so it can overhang the header row) < date column (z-30, so cells,
                    rings, AND stars all disappear under it when scrolled) < this corner cell
                    (z-40, covers both headers scrolling beneath it) < scroll chevrons (z-50). */}
                  {/* The ink box-shadows on this cell and the row-label cells below bridge the
                    sub-pixel seams between adjacent sticky cells (the thead row's text-driven
                    height is fractional), which otherwise let the z-20 star show through as a
                    hairline when it scrolls beneath the label column. */}
                  {/* No `w-0 min-w-16`: this corner cell sits in the table's authoritative first
                    row, so under fixed layout a width here would contradict the colgroup's
                    GRID_LABEL_WIDTH track. The colgroup owns every column width now. */}
                  {hasLabelColumn && (
                    <th
                      className="sticky top-0 left-0 z-40 bg-[var(--ink)] shadow-[0_2px_0_var(--ink)]"
                      data-scroll-label
                    />
                  )}
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
                      // budgeted, and the next header is opaque and at the same z-index, so it
                      // would paint over the spill and slice the label mid-glyph. The ellipsis
                      // makes that degrade legibly. The accessible name is unaffected — the full
                      // range lives in aria-label above — so this is a purely visual clamp.
                      className="sticky top-0 z-10 overflow-hidden bg-[var(--ink)] px-0.5 pt-0 pb-0.5 text-center text-xs font-semibold text-ellipsis whitespace-nowrap text-[var(--bone)]"
                      data-scroll-column
                      key={`${column.startMinute}-${column.endMinute}`}
                      scope="col"
                    >
                      {slotLabels[index]?.label}
                      {/* `?.` and `?? 0` are belt and braces, not a guard against any state this
                        app can reach: results/index.tsx keeps slotLabels parallel to columns
                        whenever it is non-empty, and when it is empty `isDatesOnly` is true and
                        this whole <thead> never renders. What they do buy is a direct consumer — a
                        test, say — passing shorter arrays than `columns`, where the naive `!== 0`
                        check would pass on `undefined` and then throw dereferencing .dayOffset.
                        aria-hidden because the same fact is already spelled out in this header's
                        aria-label and in every cell's — a bare `+1` read aloud is noise. */}
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
              {dateLabels.map((dateLabel, dateIndex) => {
                const dateAriaLabel = dateAriaLabels[dateIndex]
                return (
                  // Positional, deliberately, and NOT `dateLabel`: buildGridDateLabels repeats the
                  // month only when it changes, so every row after the first in a month is a bare
                  // `Weekday Day` — and two months that begin on the same weekday collide. April
                  // and July 2026 are aligned, so ['2026-04-07', '2026-04-08', '2026-07-07',
                  // '2026-07-08'] yields ['Tue Apr 7', 'Wed 8', 'Tue Jul 7', 'Wed 8']. Poll
                  // creation permits non-contiguous multi-select across a 365-day range, so that
                  // shape is reachable, and a duplicate key lets React reuse one row's cells and
                  // popover trigger for a row holding a different date. HeatGrid has no ISO date to
                  // key on (PaintGrid does, and keys on it); the row index is the honest identity
                  // here, since these rows are purely positional and never reordered.
                  <tr key={dateIndex}>
                    {hasLabelColumn && (
                      <th
                        // A `<th scope="row">`'s own text is announced during table navigation, the
                        // same way a `<th scope="col">`'s is, so without this a row after a month
                        // change announces `Fri 5` — a date with no month in it. The full comma'd
                        // form stays here; the abbreviation stays a purely visual economy.
                        aria-label={dateAriaLabel}
                        // pr-2 pl-1 is exactly the 0.75rem (12px at a 16px root) of padding
                        // GRID_LABEL_WIDTH (5.25rem) assumes.
                        // Widen it and the widest label — `Wed May 28`, see slot-columns.ts — no
                        // longer fits, and because this cell is whitespace-nowrap text-right the
                        // overflow spills LEFT out of the scrollport rather than clipping visibly,
                        // which is easy to miss and hard to attribute. The w-0 hack this replaces
                        // is gone: the colgroup pins the column now.
                        className="sticky left-0 z-30 bg-[var(--ink)] py-0 pr-2 pl-1 text-right text-xs font-normal whitespace-nowrap text-[var(--slate)] shadow-[0_-2px_0_var(--ink),0_2px_0_var(--ink)]"
                        scope="row"
                      >
                        {dateLabel}
                      </th>
                    )}
                    {Array.from({ length: columnCount }, (_, index) => {
                      const cell = isDatesOnly
                        ? cells[dateIndex]?.[0]
                        : findCellForColumn(cells[dateIndex] ?? [], columns[index])
                      if (!isDatesOnly && !cell) {
                        return (
                          <td className="p-0.5" key={`${columns[index].startMinute}-${columns[index].endMinute}`}>
                            <div aria-hidden="true" className={`${DISABLED_CELL_CLASS} w-full`} />
                          </td>
                        )
                      }
                      const freeCount = cell?.freeCount ?? 0
                      const color = heatColorFor(freeCount, participantCount)
                      // Deliberately the long form, never what the header displays — the same rule
                      // dateAriaLabel above follows. A cell is the only place a screen reader hears
                      // the date or the time at all when the user tabs straight into the grid, and
                      // a single-date poll has no row header to fall back on.
                      const slotAriaLabel = isDatesOnly ? undefined : slotAriaLabels[index]
                      const recommended = cell ? isRecommendedCell(cell, recommendedMeetings) : false
                      const best = cell ? isBestSlotCell(cell, bestSlot) : false
                      const statusSuffix = recommended ? (best ? ', recommended, best time' : ', recommended') : ''
                      return (
                        <td className="p-0.5" key={index}>
                          <button
                            aria-expanded={selected === cell}
                            aria-haspopup="dialog"
                            aria-label={`${dateAriaLabel}${slotAriaLabel ? `, ${slotAriaLabel}` : ''}, ${freeCount} of ${participantCount} free${statusSuffix}`}
                            className={`relative flex h-8 w-full items-center justify-center rounded text-xs font-bold ${FOCUS_RING}`}
                            onClick={(event) => {
                              if (!cell) return
                              triggerRef.current = event.currentTarget
                              if (selected === cell) {
                                setSelected(null)
                                return
                              }
                              setSelected(cell)
                            }}
                            style={{ background: color, color: pickAccessibleTextColor(color) }}
                            type="button"
                          >
                            {freeCount}
                            {recommended && (
                              // A bordered span, not `outline`: outlines paint in the CSS outline
                              // phase, on top of every same-stacking-context element regardless of
                              // z-index — including the sticky date column — so an outlined ring
                              // stayed visible over the date labels after horizontal scroll. A
                              // bordered child paints at the cell's own level and hides correctly.
                              // -inset-0.5 keeps the ring inside this cell's own padding, so a
                              // neighboring sticky cell's opaque box never clips it at rest.
                              <span
                                aria-hidden="true"
                                className="absolute -inset-0.5 rounded-md border-2 border-[var(--gold)]"
                              />
                            )}
                            {best && (
                              <span
                                aria-hidden="true"
                                // z-20 sits between the column-header row (z-10) and the sticky date
                                // column (z-30): the badge stays visible when it overhangs the header
                                // row from a top-row cell, but still slides under the opaque date
                                // column with the rest of the cell on horizontal scroll.
                                className="absolute -top-[7px] -right-[7px] z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--gold)]"
                              >
                                <Star
                                  className="h-2 w-2 text-[var(--ink)]"
                                  data-testid="best-slot-star"
                                  fill="currentColor"
                                />
                              </span>
                            )}
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
      <div className="flex items-center gap-1 text-[10px] text-[var(--slate)]">
        <span className="whitespace-nowrap">0 free</span>
        {HEAT_STEPS.map((step) => (
          <span className="h-3 w-3 rounded" key={step.cssVar} style={{ background: `var(${step.cssVar})` }} />
        ))}
        <span className="whitespace-nowrap">all free</span>
      </div>
      <p className="text-xs text-[var(--slate)]">Tap a square to see who&rsquo;s free.</p>
      {/* The popover's state management uses three distinct patterns to work around react-aria's
        standalone Popover limitations. First, the component only mounts when a cell is selected
        (`{selected && (<PopoverContent ...>)}`), rather than always rendering with `isOpen={!!selected}`.
        This isn't just a style choice: the popover body unconditionally dereferences `selected.dateIndex`,
        `selected.freeCount`, and `selected.freeUserIds` below — an always-mounted `isOpen={!!selected}`
        variant would still render that body when `selected` is null and throw. The conditional mount is
        what makes those unguarded reads safe, by ensuring the body only ever renders while `selected` is set.

        Second, the dynamic `key={`${selected.dateIndex}-${selected.slotIndex}`}` on PopoverContent
        forces a full unmount/remount cycle whenever the user clicks a different cell while a popover is open.
        React-aria's Popover computes its on-screen position once at mount by reading `triggerRef.current`'s
        bounding rect, with no built-in reposition mechanism if that ref's pointee changes. Without the key-based
        remount, jumping between cells would leave the popover anchored to the previous cell's screen position
        while displaying the new cell's data — a visual disconnect. The remount guarantees a fresh position
        calculation against whichever button the ref currently targets.

        Third, `shouldCloseOnInteractOutside` uses a containment check rather than rejecting all clicks:
        `!(element instanceof Node) || !triggerRef.current?.contains(element)`. In standalone Popover mode
        (no DialogTrigger wrapper), react-aria's dismiss logic has no built-in knowledge that the grid cell's
        `<button>` IS the trigger, so every click registers as an "outside click" and closes the popover via
        the library's own path — including re-clicks to close or clicks on nested elements like the best-slot
        star badge. Without this override, that would close the popover before this component's own onClick
        toggle can run, producing a close-then-instantly-reopen glitch. The containment check (not identity)
        matters because `event.target` can be a descendant of the button (the star badge SVG inside a cell's
        button), not the button itself. */}
      {selected && (
        <PopoverContent
          className="rounded-xl border border-[var(--hair)] bg-[var(--ink)] shadow-lg"
          // isNonModal: this is a read-only "who's free" peek, not a workflow the user must
          // finish. Modal mode (the default) renders a blocking underlay that locks page scroll
          // and swallows the first outside click/tap as a dismiss gesture — on touch that means
          // the whole page feels frozen until an extra tap. Non-modal keeps the rest of the page
          // fully interactive; outside interactions still close the popover, they just also act
          // immediately.
          isNonModal
          isOpen
          key={`${selected.dateIndex}-${selected.slotIndex}`}
          onOpenChange={(open) => {
            if (!open) setSelected(null)
          }}
          shouldCloseOnInteractOutside={(element) =>
            !(element instanceof Node) || !triggerRef.current?.contains(element)
          }
          triggerRef={triggerRef}
        >
          <PopoverDialog aria-label={`${selected.freeCount} of ${participantCount} free`} className="p-3">
            <div className="flex flex-col gap-2 text-xs">
              <span className="font-semibold whitespace-nowrap text-[var(--bone)]">
                {selected.freeCount} of {participantCount} free:
              </span>
              {selected.freeUserIds.length === 0 ? (
                <span className="text-[var(--slate)]">Nobody yet</span>
              ) : (
                <ul className="flex flex-col gap-1 text-[var(--slate)]">
                  {orderFreeUserIds(selected.freeUserIds, viewerUserId).map((id) => {
                    if (id === viewerUserId) return <li key={id}>You</li>
                    const user = users.find((u) => u.userId === id)
                    return <li key={id}>{user ? displayName(user) : id}</li>
                  })}
                </ul>
              )}
            </div>
          </PopoverDialog>
        </PopoverContent>
      )}
    </div>
  )
}
