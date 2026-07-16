import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useRef, useState } from 'react'

import { buildUnionColumns } from '../slot-columns'
import { Toolbar } from './elements'
import PaintGrid from './grid'
import FeedbackMessage from '@components/feedback-message'
import { useDebouncedAvailabilityCommit } from '@hooks/useDebouncedAvailabilityCommit'
import { fetchAvailability, patchAvailability } from '@services/api'
import { AvailabilityCell, AvailabilityRecord, PollData, Slot } from '@types'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'
import { formatViewerSlotLabel } from '@utils/timezone'

export interface PaintingPhaseProps {
  sessionId: string
  userId: string
  poll: PollData
}

const SAVE_ERROR_MESSAGE = "Couldn't save your availability. Please try again."
const PATCH_DEBOUNCE_MS = 1250

const PaintingPhase = ({ sessionId, userId, poll }: PaintingPhaseProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const viewerTimezone = useMemo(() => detectViewerTimezone(), [])
  const queryKey = ['availability', sessionId, userId]
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  const { data: availability } = useQuery<AvailabilityRecord>({
    queryKey,
    queryFn: () => fetchAvailability(sessionId, userId),
  })

  // Snapshots the record from just before the *first* optimistic update of a debounced batch, so
  // a failed (merged) PATCH can roll back everything the batch applied, not just its last call.
  const batchStartRef = useRef<AvailabilityRecord | undefined>(undefined)

  const flushCommit = async (cells: AvailabilityCell[]): Promise<void> => {
    const previous = batchStartRef.current
    batchStartRef.current = undefined
    if (!previous) return

    try {
      const updated = await patchAvailability(sessionId, userId, { cells })
      // Server response wins over the optimistic guess if the two ever disagree.
      queryClient.setQueryData(queryKey, updated)
    } catch {
      queryClient.setQueryData(queryKey, previous)
      setErrorMessage(SAVE_ERROR_MESSAGE)
    }
  }

  const debouncedFlush = useDebouncedAvailabilityCommit(flushCommit, PATCH_DEBOUNCE_MS)

  const handleCommit = (cells: AvailabilityCell[]): void => {
    const previous = availability
    if (!previous) return

    if (!batchStartRef.current) batchStartRef.current = previous

    // Apply the paint optimistically to the cached record *before* the debounced PATCH fires, in
    // the same synchronous tick as the gesture's own overlay-clearing. That way the two cache
    // updates land in the same render: the grid never has a beat where the overlay is gone but
    // the server data is still stale, which is what caused the revert-then-reapply flicker.
    queryClient.setQueryData(queryKey, applyCellsToRecord(previous, cells))
    debouncedFlush(cells)
  }

  if (!availability) return null

  // A timed poll whose window resolves to exactly one slot renders the same
  // no-header-row grid as a dates-only poll (see grid.tsx's `showSlotHeader`), since there's
  // only one column to label — but unlike a genuinely dates-only poll, the organizer did pick a
  // specific meeting time, and nothing else on this screen says what it is. State it once here,
  // visibly and for screen readers, instead of silently dropping it.
  const columns = buildUnionColumns(poll.slots)
  const singleSlotWindow = poll.usesTimes && columns.length === 1 ? columns[0] : undefined
  const slotLabels =
    columns.length > 1
      ? columns.map((column) =>
        formatViewerSlotLabel(poll.dates[0], column.startMinute, column.endMinute, poll.timezone, viewerTimezone),
      )
      : []

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        onClear={() => handleCommit(allCells(poll.slots, false))}
        onSelectAll={() => handleCommit(allCells(poll.slots, true))}
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
        columns={columns}
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

function allCells(slots: Slot[][], value: boolean): AvailabilityCell[] {
  const cells: AvailabilityCell[] = []
  slots.forEach((dateSlots, dateIndex) => {
    dateSlots.forEach((slot) => cells.push({ dateIndex, slotIndex: slot.slotIndex, value }))
  })
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
