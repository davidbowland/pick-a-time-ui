import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useEffect, useMemo, useRef, useState } from 'react'

import { buildUnionColumns, dayOffsetLegendLine, gridContextLine, showsDateColumn } from '../slot-columns'
import { CalendarStrip, Toolbar } from './elements'
import PaintGrid from './grid'
import FeedbackMessage from '@components/feedback-message'
import { useDebouncedAvailabilityCommit } from '@hooks/useDebouncedAvailabilityCommit'
import { connectCalendar, fetchAvailability, fetchCalendarState, patchAvailability, syncCalendar } from '@services/api'
import { AvailabilityCell, AvailabilityRecord, PollData, Slot } from '@types'
import { formatShortDate } from '@utils/dates'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'
import { formatSlotDuration } from '@utils/time'
import { buildGridSlotLabels, formatViewerSlotLabel } from '@utils/timezone'

export interface PaintingPhaseProps {
  sessionId: string
  userId: string
  poll: PollData
  isSignedIn: boolean
  // Injectable so a test can assert the OAuth hand-off instead of forcing a real navigation.
  redirectTo?: (url: string) => void
}

const SAVE_ERROR_MESSAGE = "Couldn't save your availability. Please try again."
const PATCH_DEBOUNCE_MS = 1250
// The API's OAuth callback lands on a fixed /calendar-connected path carrying no session context,
// so stashing the current path here is the only way back to the poll the person left.
const CALENDAR_RETURN_KEY = 'pat_calendar_return'

const assignLocation = (url: string): void => {
  window.location.href = url
}

const PaintingPhase = ({
  sessionId,
  userId,
  poll,
  isSignedIn,
  redirectTo = assignLocation,
}: PaintingPhaseProps): React.ReactNode => {
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
  // Counts every commit. A PATCH captures the count when it flushes; by the time its response
  // arrives, a differing count means newer cells were painted while it was in flight — cells the
  // response knows nothing about. Writing such a stale response (or a stale-failure rollback)
  // into the cache would visibly revert those newer paints until their own PATCH lands.
  const editCountRef = useRef(0)

  const flushCommit = async (cells: AvailabilityCell[]): Promise<void> => {
    const previous = batchStartRef.current
    batchStartRef.current = undefined
    if (!previous) return
    const editCountAtFlush = editCountRef.current

    try {
      const updated = await patchAvailability(sessionId, userId, { cells })
      // Server response wins over the optimistic guess if the two ever disagree — but only when
      // nothing newer has been painted since; otherwise the still-pending batch owns the cache
      // and its own PATCH response will reconcile with the server.
      if (editCountRef.current === editCountAtFlush) queryClient.setQueryData(queryKey, updated)
    } catch {
      if (editCountRef.current === editCountAtFlush) queryClient.setQueryData(queryKey, previous)
      setErrorMessage(SAVE_ERROR_MESSAGE)
    }
  }

  const { commit: debouncedFlush, flush: flushPending } = useDebouncedAvailabilityCommit(flushCommit, PATCH_DEBOUNCE_MS)

  const { data: calendar } = useQuery({
    enabled: isSignedIn,
    queryFn: fetchCalendarState,
    // No session or user in the key: a calendar connection belongs to a Google account, so the app
    // bar and every poll read the same entry and one disconnect invalidates all of them.
    queryKey: ['calendar'],
  })
  const [dismissed, setDismissed] = useState(false)
  const [markedBusyCount, setMarkedBusyCount] = useState<number | null>(null)
  // The same counter `flushCommit` reads, captured when a check starts. See editCountRef above.
  const editCountAtSyncRef = useRef(0)

  const syncMutation = useMutation({
    mutationFn: async (force: boolean) => {
      // Drain anything the debounce is still holding: the check rewrites this record server-side,
      // and paints left sitting in the debounce would be thrown away by the record it returns.
      flushPending()
      return syncCalendar(sessionId, userId, force)
    },
    onMutate: () => {
      editCountAtSyncRef.current = editCountRef.current
    },
    onSuccess: (result) => {
      // Only claim a count when the check actually ran. A skipped check (`applied: false`) reports
      // zero because it did nothing, not because the calendar is clear -- and this phase remounts on
      // every tab switch, so that skip is the common case, not an edge one.
      setMarkedBusyCount(result.applied ? result.markedBusyCount : null)
      // Same guard the PATCH path uses: if cells were painted while this was in flight, the
      // response predates them and writing it would visibly revert those paints.
      if (editCountRef.current === editCountAtSyncRef.current) {
        queryClient.setQueryData(queryKey, result.availability)
      }
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      // Hours the check marked busy change everyone's overlap, not just this grid.
      void queryClient.invalidateQueries({ queryKey: ['overlap', sessionId] })
    },
  })

  const connectMutation = useMutation({
    mutationFn: () => connectCalendar(sessionId, userId),
    onSuccess: ({ authUrl }) => {
      // alreadyConnected comes back with no authUrl: there is nothing to consent to, and the
      // refreshed ['calendar'] query is what moves the strip to its connected state.
      if (!authUrl) {
        void queryClient.invalidateQueries({ queryKey: ['calendar'] })
        return
      }
      sessionStorage.setItem(CALENDAR_RETURN_KEY, window.location.pathname + window.location.search)
      redirectTo(authUrl)
    },
  })

  // Fire once per mount and let the server decide whether it does anything: an unforced check is a
  // no-op if this poll was already checked. The ref is what makes strict mode's double-invoke, and
  // any later re-render, unable to fire a second one. The availability record deliberately carries
  // no checked-at timestamp to consult -- it is served unauthenticated, so a visible value would
  // tell anyone holding the poll link which participants have a calendar connected.
  const checkFiredRef = useRef(false)
  const { mutate: runSync } = syncMutation
  useEffect(() => {
    if (calendar?.status === 'connected' && !checkFiredRef.current) {
      checkFiredRef.current = true
      runSync(false)
    }
  }, [calendar?.status, runSync])

  const handleCommit = (cells: AvailabilityCell[]): void => {
    const previous = availability
    if (!previous) return

    if (!batchStartRef.current) batchStartRef.current = previous
    editCountRef.current += 1

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
  // The same short-visible / long-accessible split the slot labels use. `formatShortDate` is
  // untouched by the grid-density work precisely so it can stay the long form here.
  const dateAriaLabels = poll.dates.map((date) => formatShortDate(date))

  // Whatever the grid can no longer say for itself, said once above it. Both halves are derived
  // from the same predicates the grid uses — `showsDateColumn` for the row column, `columns.length`
  // for the header row — so the line and the thing it replaces can never both appear or both
  // vanish. `gridContextLine` owns the wording so painting and results cannot drift apart.
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

  // A check that never reached Google leaves the stored connection state reading `connected`, so
  // without this the failure is silent -- the grid just doesn't change and nothing says why.
  const calendarStatus = syncMutation.isError ? 'error' : calendar?.status
  // "Not now" only hides the invitation. Once a calendar is connected the strip is the only place
  // that explains why hours turned busy, so dismissing it there would hide the explanation.
  const showsCalendarStrip = isSignedIn && calendarStatus && !(calendarStatus === 'not_connected' && dismissed)

  return (
    <div className="flex flex-col gap-4">
      {showsCalendarStrip && (
        <CalendarStrip
          isChecking={syncMutation.isPending}
          lastSyncedAt={calendar?.lastSyncedAt ?? null}
          markedBusyCount={markedBusyCount}
          onCheckAgain={() => syncMutation.mutate(true)}
          onConnect={() => connectMutation.mutate()}
          onDismiss={() => setDismissed(true)}
          status={calendarStatus}
          usesTimes={poll.usesTimes}
        />
      )}
      <Toolbar
        onClear={() => handleCommit(allCells(poll.slots, false))}
        onSelectAll={() => handleCommit(allCells(poll.slots, true))}
      />
      {gridContext && <p className="text-xs text-[var(--slate)]">{gridContext}</p>}
      {slotDuration && <p className="text-xs text-[var(--slate)]">{slotDuration}</p>}
      {dayOffsetLegend && <p className="text-xs text-[var(--slate)]">{dayOffsetLegend}</p>}
      <PaintGrid
        columns={columns}
        dateAriaLabels={dateAriaLabels}
        dates={poll.dates}
        grid={availability.free}
        onCommit={handleCommit}
        slotAriaLabels={slotAriaLabels}
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
