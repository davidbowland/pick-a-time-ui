import { useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useState } from 'react'

import { Toolbar } from './elements'
import PaintGrid from './grid'
import FeedbackMessage from '@components/feedback-message'
import { fetchAvailability, patchAvailability } from '@services/api'
import { AvailabilityCell, AvailabilityRecord, PlanData } from '@types'

export interface PaintingPhaseProps {
  sessionId: string
  userId: string
  plan: PlanData
}

const hourLabel = (hour: number): string => {
  const hr = hour % 12 === 0 ? 12 : hour % 12
  return `${hr}${hour < 12 ? 'a' : 'p'}`
}
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// NOTE: `AvailabilityRecord` has no `calendarConnected` field yet — the API's calendar-sync
// plan hasn't shipped. There is deliberately no calendar toggle rendered here; wiring one up
// against a field that doesn't exist would look interactive while silently doing nothing.
// Add it back once the API exposes real calendar-connection state.
const SAVE_ERROR_MESSAGE = "Couldn't save your availability. Please try again."

const PaintingPhase = ({ sessionId, userId, plan }: PaintingPhaseProps): React.ReactNode => {
  const queryClient = useQueryClient()
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
      const updated = await patchAvailability(sessionId, userId, { weekIndex: null, cells, resetToPattern: false })
      // Server response wins over the optimistic guess if the two ever disagree.
      queryClient.setQueryData(queryKey, updated)
    } catch {
      queryClient.setQueryData(queryKey, previous)
      setErrorMessage(SAVE_ERROR_MESSAGE)
    }
  }

  if (!availability) return null

  const hourLabels = Array.from({ length: plan.endHour - plan.startHour }, (_, i) => hourLabel(plan.startHour + i))
  const dayLabels = plan.weekdays.map((d) => DAY_NAMES[d])

  return (
    <div className="flex flex-col gap-4">
      <Toolbar
        onAllDay={() => handleCommit(allCells(hourLabels.length, dayLabels.length, true))}
        onClear={() => handleCommit(allCells(hourLabels.length, dayLabels.length, false))}
      />
      <PaintGrid dayLabels={dayLabels} grid={availability.template} hourLabels={hourLabels} onCommit={handleCommit} />
      <FeedbackMessage message={errorMessage} onClose={() => setErrorMessage(undefined)} severity="error" />
    </div>
  )
}

function allCells(hourCount: number, dayCount: number, value: boolean): AvailabilityCell[] {
  const cells: AvailabilityCell[] = []
  for (let h = 0; h < hourCount; h++) {
    for (let d = 0; d < dayCount; d++) {
      cells.push({ hourIndex: h, dayIndex: d, value })
    }
  }
  return cells
}

function applyCellsToRecord(record: AvailabilityRecord, cells: AvailabilityCell[]): AvailabilityRecord {
  const template = record.template.map((row) => [...row])
  for (const cell of cells) {
    template[cell.hourIndex][cell.dayIndex] = cell.value
  }
  return { ...record, template }
}

export default PaintingPhase
