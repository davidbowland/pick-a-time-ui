import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import React, { useMemo, useRef, useState } from 'react'

import { buildUnionColumns, dayOffsetLegendLine, gridContextLine, showsDateColumn } from '../slot-columns'
import { CalendarStrip, GridKey, StripReport, Toolbar } from './elements'
import PaintGrid from './grid'
import FeedbackMessage from '@components/feedback-message'
import { useDebouncedAvailabilityCommit } from '@hooks/useDebouncedAvailabilityCommit'
import {
  connectCalendar,
  fetchAvailability,
  fetchAvailabilityAuthed,
  fetchCalendarState,
  patchAvailability,
  syncCalendar,
} from '@services/api'
import { AvailabilityCell, CalendarStatus, OwnerAvailabilityRecord, PollData, Slot } from '@types'
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
  // Injectable for the same reason the strip takes one: "Checked 2 minutes ago" is computed from a
  // real epoch, and a test that asserts the string cannot depend on the day it runs.
  now?: () => number
}

const SAVE_ERROR_MESSAGE = "Couldn't save your availability. Please try again."
const CONNECT_ERROR_MESSAGE = "Couldn't connect Google Calendar. Please try again."
// The API refuses with 403 for exactly one reason: this participant is linked to another Google
// account. Retrying cannot fix that, so the message names the cause and the only move that does.
const WRONG_ACCOUNT_MESSAGE =
  "You're signed in with a different Google account than the one that joined this poll. Sign out, then sign in with that account."
// What the busy layer is read over, said once. Both halves are limits of the permission itself --
// calendar.freebusy on the primary calendar, over this poll's dates -- rather than promises.
const CALENDAR_SCOPE_LINE = 'We only check your primary calendar, and only the dates in this poll.'
// The on-screen reason an inert fill control points at (AC-032). A single id because only one such
// control is ever rendered, and the strip has to be able to name it without reaching into the DOM.
const FILL_REASON_ID = 'calendar-fill-reason'

/**
 * Whether a failed connect was refused as somebody else's participant.
 *
 * Read structurally rather than with `instanceof ApiError`, and deliberately not delegated to
 * `hasStatusCode` in `@services/api`: this file's own test mocks that module wholesale, so the
 * delegate would resolve to an automock returning `undefined` and every refusal would fall through
 * to the generic message. See the longer note on `isPollGone` in ../index.tsx.
 */
const isWrongAccount = (err: unknown): boolean =>
  (err as { response?: { statusCode?: number } } | null | undefined)?.response?.statusCode === 403
const PATCH_DEBOUNCE_MS = 1250
// The API's OAuth callback lands on a fixed /calendar-connected path carrying no session context,
// so stashing the current path here is the only way back to the poll the person left.
const CALENDAR_RETURN_KEY = 'pat_calendar_return'

const assignLocation = (url: string): void => {
  window.location.href = url
}

interface CellRef {
  dateIndex: number
  slotIndex: number
}

const cellKey = (cell: CellRef): string => `${cell.dateIndex}:${cell.slotIndex}`

interface GridSurvey {
  // Slots both marked free and booked. Every one is a question the strip may have to ask.
  conflicts: CellRef[]
  // Slots the fill would paint: unmarked and unbooked, which is the whole of what it may touch.
  fillable: CellRef[]
  // Booked slots the participant has not marked. This is what a fill LEAVES unpainted, and so what
  // it reports as skipped -- not the total booked, which counts slots already marked free and
  // therefore never candidates for painting in the first place (AC-040).
  bookedUnmarked: number
  markedCount: number
}

/**
 * Reads the grid once and answers every question the strip and the key ask of it.
 *
 * Iterates the poll's own slots rather than the availability arrays, so a date whose window omits
 * a shared column contributes nothing for it — the same cells the grid draws, and no others.
 * `busy` is read by `slot.slotIndex`, never by column position, for the reason spelled out in
 * grid.tsx: the two diverge exactly on the dates with a per-date override.
 */
function surveyGrid(slots: Slot[][], free: boolean[][], busy: boolean[][] | undefined): GridSurvey {
  const cells = slots.flatMap((dateSlots, dateIndex) =>
    dateSlots.map((slot) => ({
      booked: busy?.[dateIndex]?.[slot.slotIndex] ?? false,
      dateIndex,
      marked: free[dateIndex]?.[slot.slotIndex] ?? false,
      slotIndex: slot.slotIndex,
    })),
  )
  const refs = (kept: typeof cells): CellRef[] => kept.map(({ dateIndex, slotIndex }) => ({ dateIndex, slotIndex }))
  return {
    bookedUnmarked: cells.filter((cell) => cell.booked && !cell.marked).length,
    conflicts: refs(cells.filter((cell) => cell.booked && cell.marked)),
    fillable: refs(cells.filter((cell) => !cell.booked && !cell.marked)),
    markedCount: cells.filter((cell) => cell.marked).length,
  }
}

const gridsMatch = (left: boolean[][] | undefined, right: boolean[][] | undefined): boolean =>
  left !== undefined && right !== undefined && JSON.stringify(left) === JSON.stringify(right)

const PaintingPhase = ({
  sessionId,
  userId,
  poll,
  isSignedIn,
  redirectTo = assignLocation,
  now = Date.now,
}: PaintingPhaseProps): React.ReactNode => {
  const queryClient = useQueryClient()
  const viewerTimezone = useMemo(() => detectViewerTimezone(), [])
  const queryKey = ['availability', sessionId, userId]
  const [errorMessage, setErrorMessage] = useState<string | undefined>()

  // Signed in, this goes through the authenticated route — the only one in the API that serves a
  // busy layer, and only to the participant it belongs to. It falls back to the open read on a
  // refusal itself (AC-044), so there is nothing to catch here.
  const { data: availability } = useQuery<OwnerAvailabilityRecord>({
    queryFn: () => (isSignedIn ? fetchAvailabilityAuthed(sessionId, userId) : fetchAvailability(sessionId, userId)),
    queryKey,
  })

  /**
   * The one way this component writes the availability cache entry.
   *
   * Always a merge, never a substitution. The busy layer rides this same entry (D-9) and neither a
   * PATCH response nor a sync response carries the whole of it — a PATCH answers with `free` and no
   * `busy`, a check answers with `busy` and no `free`. `setQueryData(queryKey, response)` would
   * therefore take one of the two off the grid every time the other was written, which looks like
   * the calendar layer flickering out on the next paint rather than like a bug in a cache write.
   */
  const mergeCachedRecord = (fields: Partial<OwnerAvailabilityRecord>): void => {
    queryClient.setQueryData<OwnerAvailabilityRecord>(queryKey, (current) =>
      current ? { ...current, ...fields } : current,
    )
  }

  // Snapshots the record from just before the *first* optimistic update of a debounced batch, so
  // a failed (merged) PATCH can roll back everything the batch applied, not just its last call.
  const batchStartRef = useRef<OwnerAvailabilityRecord | undefined>(undefined)
  // Counts every commit. A PATCH captures the count when it flushes; by the time its response
  // arrives, a differing count means newer cells were painted while it was in flight — cells the
  // response knows nothing about. Writing such a stale response (or a stale-failure rollback)
  // into the cache would visibly revert those newer paints until their own PATCH lands. This is
  // paint against paint and has nothing to do with the calendar, which no longer writes here.
  const editCountRef = useRef(0)

  const commitCells = async (cells: AvailabilityCell[]): Promise<void> => {
    const previous = batchStartRef.current
    batchStartRef.current = undefined
    if (!previous) return
    const editCountAtFlush = editCountRef.current

    try {
      const updated = await patchAvailability(sessionId, userId, { cells }, isSignedIn)
      // Server response wins over the optimistic guess if the two ever disagree — but only when
      // nothing newer has been painted since; otherwise the still-pending batch owns the cache
      // and its own PATCH response will reconcile with the server.
      if (editCountRef.current === editCountAtFlush) mergeCachedRecord(updated)
    } catch (err) {
      // Only `free` is rolled back. The snapshot may predate a check that has since landed, and
      // reverting somebody's calendar to what it said a second ago is not what a failed save means.
      if (editCountRef.current === editCountAtFlush) mergeCachedRecord({ free: previous.free })
      // A refusal is not a flaky connection, and "try again" would be a lie: every later paint on
      // this participant is refused too. Only the authenticated route can answer 403, so this is
      // reachable only while signed in.
      setErrorMessage(isWrongAccount(err) ? WRONG_ACCOUNT_MESSAGE : SAVE_ERROR_MESSAGE)
    }
  }

  const { commit: debouncedFlush } = useDebouncedAvailabilityCommit(commitCells, PATCH_DEBOUNCE_MS)

  const { data: calendar } = useQuery({
    enabled: isSignedIn,
    queryFn: fetchCalendarState,
    // No session or user in the key: a calendar connection belongs to a Google account, so the app
    // bar and every poll read the same entry and one disconnect invalidates all of them.
    queryKey: ['calendar'],
  })
  const [dismissed, setDismissed] = useState(false)
  // What the strip has to say about the last thing that happened. Session state, and deliberately
  // short-lived: a check clears it, because a report of a fill that ran a minute ago is not an
  // answer to "what did the check just find".
  const [report, setReport] = useState<StripReport | undefined>()
  const [lastCheckedAt, setLastCheckedAt] = useState<number | undefined>()
  /**
   * Conflicts the participant has chosen to live with, keyed per slot.
   *
   * **Session state, never persisted.** Which conflicts somebody decided to keep is a decision
   * about their calendar, and storing it in a poll record would keep exactly the provenance this
   * feature refuses to keep. It costs a re-ask on reload, which is the cheaper mistake.
   *
   * Keyed per slot rather than held as a single "don't ask" flag so a conflict created later is
   * not covered by an earlier decision (AC-028), and dropped again the moment the participant
   * touches that slot by hand — repainting a slot they had cleared is a fresh decision about it.
   */
  const [kept, setKept] = useState<ReadonlySet<string>>(() => new Set())

  const syncMutation = useMutation({
    mutationFn: (force: boolean) => syncCalendar(sessionId, userId, force),
    onMutate: () => setReport(undefined),
    onSuccess: (result) => {
      // Read back out of the cache rather than off a closure: this resolves a network round trip
      // after the render that started it, and the record may well have moved since.
      const previous = queryClient.getQueryData<OwnerAvailabilityRecord>(queryKey)
      setLastCheckedAt(result.lastSyncedAt)
      // Silence after pressing `Check again` reads as a control that did nothing, so a check that
      // found the same booked time as last time says so. A first check has nothing to compare
      // against and reports through the ordinary connected copy instead.
      setReport(gridsMatch(previous?.busy, result.busy) ? { kind: 'unchanged' } : undefined)
      mergeCachedRecord({
        busy: result.busy,
        busyWindow: result.busyWindow,
        calendarStatus: result.calendarStatus,
      })
      void queryClient.invalidateQueries({ queryKey: ['calendar'] })
      // No overlap invalidation. A check writes nothing now — it reads the calendar and returns
      // what it read — so nobody else's view of this poll can have changed because of it.
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
    // Without this the whole failure is invisible: the button neither redirects nor says anything,
    // which reads as a click that never registered.
    onError: (err: unknown) => setErrorMessage(isWrongAccount(err) ? WRONG_ACCOUNT_MESSAGE : CONNECT_ERROR_MESSAGE),
  })

  const handleCommit = (cells: AvailabilityCell[]): void => {
    const previous = availability
    if (!previous || cells.length === 0) return

    if (!batchStartRef.current) batchStartRef.current = previous
    editCountRef.current += 1
    // A slot the participant just committed by hand is a fresh decision about that slot, so any
    // earlier "keep it as it is" for it stops applying — repaint a cleared conflict and the strip
    // asks again, which is what AC-028 means by a newly created one.
    setKept((current) => withoutCells(current, cells))

    // Apply the paint optimistically to the cached record *before* the debounced PATCH fires, in
    // the same synchronous tick as the gesture's own overlay-clearing. That way the two cache
    // updates land in the same render: the grid never has a beat where the overlay is gone but
    // the server data is still stale, which is what caused the revert-then-reapply flicker.
    mergeCachedRecord({ free: applyCells(previous.free, cells) })
    debouncedFlush(cells)
  }

  if (!availability) return null

  // A check that never reached Google leaves the stored connection state reading `connected`, so
  // without this the failure is silent -- the grid just doesn't change and nothing says why. A
  // record whose own read failed says `error` the same way, and outranks the account-level status
  // for the same reason: it is the newer fact about this poll's calendar data.
  const failed = syncMutation.isError || availability.calendarStatus === 'error'
  const calendarStatus: CalendarStatus | undefined = failed
    ? 'error'
    : (calendar?.status ?? availability.calendarStatus)
  /**
   * The layer, and the whole of the mechanism behind AC-030.
   *
   * `PaintGrid` takes no status prop: it learns the layer is not drawn by not being handed one, so
   * a name can never claim `booked` for something the reader cannot see. That makes withholding
   * this the only thing standing between a failed check and a grid that still asserts booked time
   * from the last one. `checking` keeps it — what is on screen stays on screen (AC-031) — because
   * an in-flight check leaves `calendarStatus` exactly where it was.
   */
  const busy = calendarStatus === 'connected' ? availability.busy : undefined

  const survey = surveyGrid(poll.slots, availability.free, busy)
  const liveConflicts = survey.conflicts.filter((conflict) => !kept.has(cellKey(conflict)))

  const handleFill = (): void => {
    setReport({ kind: 'filled', markedCount: survey.fillable.length, skippedCount: survey.bookedUnmarked })
    // Only `true`, ever. Nothing painted comes off, which is why there is nothing to confirm
    // (AC-037) — a bulk action that cannot destroy anything does not need to ask.
    handleCommit(survey.fillable.map((cell) => ({ ...cell, value: true })))
  }

  const handleClearConflicts = (): void => {
    setReport({ count: liveConflicts.length, kind: 'cleared' })
    handleCommit(liveConflicts.map((cell) => ({ ...cell, value: false })))
  }

  const handleKeepConflicts = (): void => {
    setReport({ count: liveConflicts.length, kind: 'kept' })
    setKept((current) => new Set([...current, ...liveConflicts.map(cellKey)]))
  }

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

  // "Not now" only hides the invitation. Once a calendar is connected the strip is the only place
  // that reports what the check found, so dismissing it there would hide the explanation.
  const showsCalendarStrip = isSignedIn && calendarStatus && !(calendarStatus === 'not_connected' && dismissed)
  // The on-screen reason the inert fill points at. Rendered from the same two conditions that make
  // it inert, so the reference can never dangle.
  const fillReason = syncMutation.isPending
    ? "You can fill in what's free once the check finishes."
    : calendarStatus === 'error'
      ? "You can fill in what's free once we reach your calendar."
      : undefined

  return (
    <div className="flex flex-col gap-4">
      {showsCalendarStrip && (
        <CalendarStrip
          bookedCount={survey.bookedUnmarked + survey.conflicts.length}
          busyWindow={availability.busyWindow}
          conflictCount={liveConflicts.length}
          fillReasonId={FILL_REASON_ID}
          fillableCount={survey.fillable.length}
          hasBusyLayer={busy !== undefined}
          isChecking={syncMutation.isPending}
          isConnecting={connectMutation.isPending}
          lastSyncedAt={lastCheckedAt ?? calendar?.lastSyncedAt ?? null}
          markedCount={survey.markedCount}
          now={now}
          onCheckAgain={() => syncMutation.mutate(true)}
          onClearConflicts={handleClearConflicts}
          onConnect={() => connectMutation.mutate()}
          onDismiss={() => setDismissed(true)}
          onFill={handleFill}
          onKeepConflicts={handleKeepConflicts}
          report={report}
          status={calendarStatus}
        />
      )}
      <Toolbar
        onClear={() => handleCommit(allCells(poll.slots, false))}
        onSelectAll={() => handleCommit(allCells(poll.slots, true))}
      />
      {gridContext && <p className="text-xs text-[var(--slate)]">{gridContext}</p>}
      {slotDuration && <p className="text-xs text-[var(--slate)]">{slotDuration}</p>}
      {dayOffsetLegend && <p className="text-xs text-[var(--slate)]">{dayOffsetLegend}</p>}
      {/* Said only while the layer is drawn, because it describes a read that happened. On an
          errored check there is no layer and this would be describing nothing. */}
      {busy && <p className="text-xs text-[var(--slate)]">{CALENDAR_SCOPE_LINE}</p>}
      {fillReason && (
        <p className="text-xs text-[var(--slate)]" id={FILL_REASON_ID}>
          {fillReason}
        </p>
      )}
      <GridKey markedBookedCount={survey.conflicts.length} unmarkedBookedCount={survey.bookedUnmarked} />
      <PaintGrid
        busy={busy}
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

function applyCells(free: boolean[][], cells: AvailabilityCell[]): boolean[][] {
  const updated = free.map((row) => [...row])
  for (const cell of cells) {
    updated[cell.dateIndex][cell.slotIndex] = cell.value
  }
  return updated
}

// Returns the same set when nothing was dropped, so an ordinary paint on a grid with no kept
// conflicts does not churn a new object through state on every stroke.
function withoutCells(kept: ReadonlySet<string>, cells: AvailabilityCell[]): ReadonlySet<string> {
  const dropped = cells.map(cellKey).filter((key) => kept.has(key))
  if (dropped.length === 0) return kept
  return new Set([...kept].filter((key) => !dropped.includes(key)))
}

export default PaintingPhase
