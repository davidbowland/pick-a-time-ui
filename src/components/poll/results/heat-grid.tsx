import React, { useMemo, useRef, useState } from 'react'

import { DISABLED_CELL_CLASS, TimeWindow, findCellForColumn } from '../slot-columns'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { useInitialColumnScroll } from '@hooks/useInitialColumnScroll'
import { OverlapCell } from '@services/api'
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

export const HeatGrid = ({
  cells,
  columns,
  dateLabels,
  slotLabels,
  participantCount,
  users,
}: {
  cells: OverlapCell[][]
  columns: TimeWindow[]
  dateLabels: string[]
  slotLabels: string[]
  participantCount: number
  users: User[]
}): React.ReactNode => {
  const [selected, setSelected] = useState<OverlapCell | null>(null)
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

  return (
    <div className="flex flex-col gap-3">
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
      <div className="max-h-[32rem] overflow-auto" ref={containerRef}>
        <table className="w-full border-separate border-spacing-1">
          {!isDatesOnly && (
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-10 min-w-32 bg-[var(--ink)]" data-scroll-label />
                {columns.map((column, index) => (
                  <th
                    className="sticky top-0 z-10 min-w-20 bg-[var(--ink)] p-0 text-center text-xs font-semibold text-[var(--bone)]"
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
                  className="sticky left-0 z-10 min-w-32 bg-[var(--ink)] py-0 pr-3 pl-0 text-right text-xs font-normal text-[var(--slate)]"
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
                      <td className="p-0" key={`${columns[index].startMinute}-${columns[index].endMinute}`}>
                        <div aria-hidden="true" className={`${DISABLED_CELL_CLASS} w-full`} />
                      </td>
                    )
                  }
                  const freeCount = cell?.freeCount ?? 0
                  const color = heatColorFor(freeCount, participantCount)
                  const slotLabel = isDatesOnly ? undefined : slotLabels[index]
                  return (
                    <td className="p-0" key={index}>
                      <button
                        aria-label={`${dateLabel}${slotLabel ? `, ${slotLabel}` : ''}, ${freeCount} of ${participantCount} free`}
                        className={`flex h-8 w-full items-center justify-center rounded text-xs font-bold ${FOCUS_RING}`}
                        onClick={() => cell && setSelected(cell)}
                        style={{ background: color, color: pickAccessibleTextColor(color) }}
                        type="button"
                      >
                        {freeCount}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center gap-1 text-[10px] text-[var(--slate)]">
        <span>0 free</span>
        {HEAT_STEPS.map((step) => (
          <span className="h-3 w-3 rounded" key={step.cssVar} style={{ background: `var(${step.cssVar})` }} />
        ))}
        <span>all free</span>
      </div>
      {selected ? (
        <div className="flex flex-col gap-1 text-xs text-[var(--slate)]">
          <span>
            {selected.freeCount} of {participantCount} free:
          </span>
          {selected.freeUserIds.length === 0 ? (
            <span>no one yet</span>
          ) : (
            // Each name renders as its own list item, not a single comma-joined string, so an
            // individual person's name is a discrete accessible text node rather than a
            // substring buried inside one paragraph.
            <ul className="flex flex-wrap gap-x-3 gap-y-1">
              {selected.freeUserIds.map((id) => {
                const user = users.find((u) => u.userId === id)
                return <li key={id}>{user ? displayName(user) : id}</li>
              })}
            </ul>
          )}
        </div>
      ) : (
        <p className="text-xs text-[var(--slate)]">Tap a square to see who&rsquo;s free then.</p>
      )}
    </div>
  )
}
