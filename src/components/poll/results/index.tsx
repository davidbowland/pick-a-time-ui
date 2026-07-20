import { useQuery } from '@tanstack/react-query'
import React, { useMemo } from 'react'

import { buildUnionColumns } from '../slot-columns'
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
import { formatShortDate } from '@utils/dates'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'
import { formatViewerSlotLabel } from '@utils/timezone'

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

  const dateLabels = poll.dates.map((date) => formatShortDate(date))
  const columns = buildUnionColumns(poll.slots)
  // Mirrors painting/grid.tsx's `showSlotHeader` rule exactly (`columns.length > 1`, not
  // `poll.usesTimes`) — a timed poll whose window resolves to exactly one slot (a valid,
  // already-exercised shape: a 60-minute window with a 60-minute meeting length) has one
  // implicit column just like a dates-only poll, and both grids must agree on that or the same
  // poll renders a time label in one and not the other.
  const slotLabels =
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

  return (
    <div className="flex flex-col gap-4">
      <ParticipationStatus count={participantTotal} />
      {singleSlotWindow && (
        <p className="text-xs text-[var(--slate)]">
          Meeting time:{' '}
          {formatViewerSlotLabel(
            poll.dates[0],
            singleSlotWindow.startMinute,
            singleSlotWindow.endMinute,
            poll.timezone,
            viewerTimezone,
          )}
        </p>
      )}
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
      <HeatGrid
        bestSlot={bestSlot && bestSlot.freeCount > 0 ? bestSlot : undefined}
        cells={data.grid?.cells ?? []}
        columns={columns}
        dateLabels={dateLabels}
        participantCount={participantTotal}
        recommendedMeetings={meetings}
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
