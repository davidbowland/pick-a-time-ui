import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useState } from 'react'

import { Toolbar } from './elements'
import PaintGrid from './grid'
import FeedbackMessage from '@components/feedback-message'
import { fetchAvailability, patchAvailability } from '@services/api'
import { AvailabilityCell, AvailabilityRecord, PollData } from '@types'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'
import { formatViewerSlotLabel } from '@utils/timezone'

export interface PaintingPhaseProps {
  sessionId: string
  userId: string
  poll: PollData
}

// NOTE: `AvailabilityRecord` has no `calendarConnected` field yet — the API's calendar-sync
// poll hasn't shipped. There is deliberately no calendar toggle rendered here; wiring one up
// against a field that doesn't exist would look interactive while silently doing nothing.
// Add it back once the API exposes real calendar-connection state.
const SAVE_ERROR_MESSAGE = "Couldn't save your availability. Please try again."

const PaintingPhase = ({ sessionId, userId, poll }: PaintingPhaseProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const viewerTimezone = useMemo(() => detectViewerTimezone(), [])
  const queryKey = ['availability', sessionId, userId]
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const { data: availability } = useQuery<AvailabilityRecord>({
    queryKey,
    queryFn: () => fetchAvailability(sessionId, userId),
  })

  const handleCommit = async (cells: AvailabilityCell[]): Promise<void> => {
    const previous = availability
    if (!previous) return

    // Apply the paint optimistically to the cached record *before* awaiting the PATCH, in the
    // same synchronous tick as the gesture's own overlay-clearing. That way the two cache
    // updates land in the same render: the grid never has a beat where the overlay is gone but
    // the server data is still stale, which is what caused the revert-then-reapply flicker.
    queryClient.setQueryData(queryKey, applyCellsToRecord(previous, cells))

    try {
      const updated = await patchAvailability(sessionId, userId, { cells })
      // Server response wins over the optimistic guess if the two ever disagree.
      queryClient.setQueryData(queryKey, updated)
    } catch {
      queryClient.setQueryData(queryKey, previous)
      setErrorMessage(SAVE_ERROR_MESSAGE)
    }
  }

  if (!availability) return null

  // A timed poll whose window resolves to exactly one slot renders the same
  // no-header-row grid as a dates-only poll (see grid.tsx's `showSlotHeader`), since there's
  // only one column to label — but unlike a genuinely dates-only poll, the organizer did pick a
  // specific meeting time, and nothing else on this screen says what it is. State it once here,
  // visibly and for screen readers, instead of silently dropping it.
  const singleSlotWindow = poll.usesTimes && poll.slots.length === 1 ? poll.slots[0] : undefined
  const slotLabels =
    poll.slots.length > 1
      ? poll.slots.map((slot) =>
        formatViewerSlotLabel(poll.dates[0], slot.startMinute, slot.endMinute, poll.timezone, viewerTimezone),
      )
      : []

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        onClear={() => handleCommit(allCells(poll.dates.length, poll.slots.length, false))}
        onSelectAll={() => handleCommit(allCells(poll.dates.length, poll.slots.length, true))}
      />
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
      <PaintGrid
        dates={poll.dates}
        grid={availability.free}
        onCommit={handleCommit}
        slotLabels={slotLabels}
        slots={poll.slots}
      />
      <FeedbackMessage message={errorMessage} onClose={() => setErrorMessage(undefined)} severity="error" />
    </div>
  )
}

function allCells(dateCount: number, slotCount: number, value: boolean): AvailabilityCell[] {
  const cells: AvailabilityCell[] = []
  for (let dateIndex = 0; dateIndex < dateCount; dateIndex++) {
    for (let slotIndex = 0; slotIndex < slotCount; slotIndex++) {
      cells.push({ dateIndex, slotIndex, value })
    }
  }
  return cells
}

function applyCellsToRecord(record: AvailabilityRecord, cells: AvailabilityCell[]): AvailabilityRecord {
  const free = record.free.map((row) => [...row])
  for (const cell of cells) {
    free[cell.dateIndex][cell.slotIndex] = cell.value
  }
  return { ...record, free }
}

export default PaintingPhase
