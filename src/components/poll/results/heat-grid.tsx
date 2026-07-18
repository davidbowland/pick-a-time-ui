import { PopoverContent, PopoverDialog } from '@heroui/react'
import { Star } from 'lucide-react'
import React, { useMemo, useRef, useState } from 'react'

import { ScrollEdgeIndicators } from '../scroll-edge-indicators'
import { DISABLED_CELL_CLASS, TimeWindow, findCellForColumn } from '../slot-columns'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { useInitialColumnScroll } from '@hooks/useInitialColumnScroll'
import { useScrollEdges } from '@hooks/useScrollEdges'
import { OverlapCell, RecommendedMeeting } from '@services/api'
import { User } from '@types'
import { pickAccessibleTextColor } from '@utils/contrast'
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
  dateLabels,
  slotLabels,
  participantCount,
  recommendedMeetings = [],
  bestSlot,
  users,
  viewerUserId,
}: {
  cells: OverlapCell[][]
  columns: TimeWindow[]
  dateLabels: string[]
  slotLabels: string[]
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
            scrolls under it. */}
          <table className="w-full border-separate">
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
                  <th
                    className="sticky left-0 top-0 z-40 w-0 min-w-16 bg-[var(--ink)] shadow-[0_2px_0_var(--ink)]"
                    data-scroll-label
                  />
                  {columns.map((column, index) => (
                    <th
                      className="sticky top-0 z-10 min-w-20 bg-[var(--ink)] px-0.5 pt-0 pb-0.5 text-center text-xs font-semibold text-[var(--bone)]"
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
              {dateLabels.map((dateLabel, dateIndex) => (
                <tr key={dateLabel}>
                  <th
                    // w-0 pins the label column at its min-width: with the table stretched by
                    // w-full, auto layout otherwise hands this column a large share of any spare
                    // width, leaving a wide dead zone left of the right-aligned labels.
                    className="sticky left-0 z-30 w-0 min-w-16 bg-[var(--ink)] py-0 pr-3 pl-3 text-right text-xs font-normal whitespace-nowrap text-[var(--slate)] shadow-[0_-2px_0_var(--ink),0_2px_0_var(--ink)]"
                    scope="row"
                  >
                    {dateLabel}
                  </th>
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
                    const slotLabel = isDatesOnly ? undefined : slotLabels[index]
                    const recommended = cell ? isRecommendedCell(cell, recommendedMeetings) : false
                    const best = cell ? isBestSlotCell(cell, bestSlot) : false
                    const statusSuffix = recommended ? (best ? ', recommended, best time' : ', recommended') : ''
                    return (
                      <td className="p-0.5" key={index}>
                        <button
                          aria-expanded={selected === cell}
                          aria-haspopup="dialog"
                          aria-label={`${dateLabel}${slotLabel ? `, ${slotLabel}` : ''}, ${freeCount} of ${participantCount} free${statusSuffix}`}
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
              ))}
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
