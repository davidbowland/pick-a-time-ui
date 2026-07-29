import { useQuery } from '@tanstack/react-query'
import React, { useMemo } from 'react'

import { buildUnionColumns, dayOffsetLegendLine, gridContextLine, showsDateColumn } from '../slot-columns'
import {
  BestSlotBanner,
  EmptyBestSlot,
  ErrorState,
  formatMeetingLabel,
  LoadingState,
  ParticipationStatus,
  SuggestedTimes,
} from './elements'
import { HeatGrid } from './heat-grid'
import { fetchOverlap, OverlapResponse } from '@services/api'
import { PollData, User } from '@types'
import { buildGridDateLabels, formatShortDate } from '@utils/dates'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'
import { formatSlotDuration } from '@utils/time'
import { buildGridSlotLabels, formatViewerSlotLabel } from '@utils/timezone'

export interface ResultsPhaseProps {
  sessionId: string
  poll: PollData
  users: User[]
  viewerUserId?: string
}

const ResultsPhase = ({ sessionId, poll, users, viewerUserId }: ResultsPhaseProps): React.ReactNode => {
  const viewerTimezone = useMemo(() => detectViewerTimezone(), [])
  const { data, isLoading, isError, refetch } = useQuery<OverlapResponse>({
    queryKey: ['overlap', sessionId],
    queryFn: () => fetchOverlap(sessionId),
  })

  if (isLoading) return <LoadingState />
  if (isError || !data) return <ErrorState onRetry={() => refetch()} />

  // Defensive: the API contract promises `grid`/`bestSlot`, but don't let a genuinely empty
  // or not-yet-fully-robust response take the whole screen down with it.
  const bestSlot = data.grid?.bestSlot
  const meetings = data.recommendedMeetings ?? []
  // participantCount rides the poll query while free counts ride the overlap query, and a join
  // can land between their refetches — a fresher overlap can then report more people free than
  // the stale poll says exist, rendering nonsense like "2 of 1 free". Anybody counted free is
  // proof of a participant, so the displayed total never falls below any free count on screen.
  const participantTotal = Math.max(
    poll.participantCount,
    users.length,
    bestSlot?.freeCount ?? 0,
    ...meetings.map((meeting) => meeting.freeCount),
  )
  const bestDate = bestSlot ? poll.dates[bestSlot.dateIndex] : undefined
  const bestCell = bestSlot ? data.grid.cells[bestSlot.dateIndex]?.[bestSlot.slotIndex] : undefined
  const label = bestSlot
    ? formatMeetingLabel(poll, bestDate, bestCell?.startMinute ?? 0, bestCell?.endMinute ?? 1440, viewerTimezone)
    : ''

  const dateLabels = buildGridDateLabels(poll.dates)
  // The same short-visible / long-accessible split the slot labels use. `formatShortDate` is
  // untouched by the grid-density work precisely so it can stay the long form here.
  const dateAriaLabels = poll.dates.map((date) => formatShortDate(date))
  const columns = buildUnionColumns(poll.slots)
  // Mirrors painting/grid.tsx's `showSlotHeader` rule exactly (`columns.length > 1`, not
  // `poll.usesTimes`) — a timed poll whose window resolves to exactly one slot (a valid,
  // already-exercised shape: a 60-minute window with a 60-minute meeting length) has one
  // implicit column just like a dates-only poll, and both grids must agree on that or the same
  // poll renders a time label in one and not the other.
  // Two parallel arrays, deliberately: the grid *shows* the short series-aware labels and *names*
  // every header and cell with the long ones. Both stay empty when there is at most one column,
  // which is what tells the grid to render no header row at all.
  const slotLabels =
    columns.length > 1 ? buildGridSlotLabels(columns, poll.dates[0], poll.timezone, viewerTimezone) : []
  const slotAriaLabels =
    columns.length > 1
      ? columns.map((column) =>
          formatViewerSlotLabel(poll.dates[0], column.startMinute, column.endMinute, poll.timezone, viewerTimezone),
        )
      : []
  // That same collapse means `BestSlotBanner`/`SuggestedTimes` are the only place a single-slot
  // timed poll's meeting time would show — and neither renders at all before anybody's overlap
  // exists (the `EmptyBestSlot` state, which is also the very first state anybody sees on a
  // freshly-created poll). State it here too, same as the painting grid does.
  const singleSlotWindow = poll.usesTimes && columns.length === 1 ? columns[0] : undefined

  // Whatever the grid can no longer say for itself, said once above it. Both halves are derived
  // from the same predicates the grid uses — `showsDateColumn` for the row column, `columns.length`
  // for the header row — so the line and the thing it replaces can never both appear or both
  // vanish. `gridContextLine` owns the wording, shared with painting/index.tsx: one voter moves
  // between the two screens in a single session and must not see two different sentences.
  const singleDate = showsDateColumn(poll.dates.length) ? undefined : dateAriaLabels[0]
  const singleSlotLabel = singleSlotWindow
    ? formatViewerSlotLabel(
        poll.dates[0],
        singleSlotWindow.startMinute,
        singleSlotWindow.endMinute,
        poll.timezone,
        viewerTimezone,
      )
    : undefined
  const gridContext = gridContextLine(singleDate, singleSlotLabel)
  // Required, not decorative: buildGridSlotLabels drops the end time from the final column exactly
  // because the duration is stated here instead. Without this line a uniform-duration grid never
  // says how long a slot is. A single column already gets its full range from the line above, and
  // formatSlotDuration returns undefined when durations vary — in which case the final column
  // keeps its own range.
  const slotDuration = columns.length > 1 ? formatSlotDuration(columns) : undefined
  // Reads the same dayOffset the headers mark, so the legend cannot appear without a marker on
  // screen or vanish while one is still showing.
  const dayOffsetLegend = dayOffsetLegendLine(slotLabels.map((entry) => entry.dayOffset))

  return (
    <div className="flex flex-col gap-4">
      <ParticipationStatus count={participantTotal} />
      {!bestSlot || bestSlot.freeCount === 0 ? (
        <EmptyBestSlot />
      ) : (
        <BestSlotBanner
          freeCount={bestSlot.freeCount}
          freeUserIds={bestSlot.freeUserIds ?? []}
          label={label}
          total={participantTotal}
          users={users}
          viewerUserId={viewerUserId}
        />
      )}
      {/* All three directly above the grid, exactly as in painting/index.tsx — not up beside
        ParticipationStatus, where the best-slot card (100–200px on a phone) sits between these
        lines and the thing they describe. buildGridSlotLabels drops the end time from every
        contiguous column and from the final one on the strength of the cadence line being read
        as part of the grid. The day-offset legend is here rather than below the grid for the same
        reason: the scrollport is `max-h-[32rem]`, so a legend under it is rarely on screen with
        the `+1` header it explains. */}
      {gridContext && <p className="text-xs text-[var(--slate)]">{gridContext}</p>}
      {slotDuration && <p className="text-xs text-[var(--slate)]">{slotDuration}</p>}
      {dayOffsetLegend && <p className="text-xs text-[var(--slate)]">{dayOffsetLegend}</p>}
      <HeatGrid
        bestSlot={bestSlot && bestSlot.freeCount > 0 ? bestSlot : undefined}
        cells={data.grid?.cells ?? []}
        columns={columns}
        dateAriaLabels={dateAriaLabels}
        dateLabels={dateLabels}
        participantCount={participantTotal}
        recommendedMeetings={meetings}
        slotAriaLabels={slotAriaLabels}
        slotLabels={slotLabels}
        users={users}
        viewerUserId={viewerUserId}
      />
      <SuggestedTimes
        meetings={meetings}
        participantCount={participantTotal}
        poll={poll}
        users={users}
        viewerTimezone={viewerTimezone}
        viewerUserId={viewerUserId}
      />
    </div>
  )
}

export default ResultsPhase
