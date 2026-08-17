import { CalendarClock, Check } from 'lucide-react'
import React from 'react'

import { BOOKED_CELL_FRAGMENT, CONFLICT_CELL_FRAGMENT } from '../slot-columns'
import { Chip } from '@components/ui/chip'
import { CalendarStatus, DateWindow } from '@types'
import { formatCheckedAgo, formatShortDate } from '@utils/dates'

export const Toolbar = ({
  onSelectAll,
  onClear,
}: {
  onSelectAll: () => void
  onClear: () => void
}): React.ReactNode => (
  <div className="flex gap-2">
    <Chip onPress={onSelectAll}>Select all</Chip>
    <Chip onPress={onClear}>Clear all</Chip>
  </div>
)

// A swatch is a cell at 16px, not a colour chip. Every mark below is the one grid.tsx draws in the
// cell, at the same proportions the 32px cell uses (a half-width glyph; a 2px bar inset from the
// bottom and both sides), because the fills cannot carry this key by themselves: a conflict's fill
// is *identical* to an ordinary painted cell's, and booked sits a deliberate 6% off unpainted so
// the calendar never shouts. A fill-only swatch therefore points at a square the reader cannot
// find, which is the failure AC-035 is about. `relative` so the bar can be positioned inside.
const KEY_SWATCH_FRAGMENT = 'relative flex h-4 w-4 shrink-0 items-center justify-center rounded'

/**
 * The legend for the two calendar treatments, rendered only for what is actually on screen.
 *
 * Both counts are of cells the grid is drawing *right now*, not of anything the calendar reported:
 * a key entry for a treatment nobody can see is worse than no key at all, because it sends the
 * reader hunting for a square that does not exist (AC-035). The marked-and-booked count is
 * therefore every conflicting cell drawn, including ones the participant chose to keep — those
 * cells still carry the treatment, so the key still has to explain it.
 */
export const GridKey = ({
  unmarkedBookedCount,
  markedBookedCount,
}: {
  unmarkedBookedCount: number
  markedBookedCount: number
}): React.ReactNode => {
  if (unmarkedBookedCount === 0 && markedBookedCount === 0) return null

  return (
    <ul aria-label="Key" className="flex flex-wrap items-center gap-3 text-[10px] text-[var(--slate)]">
      {unmarkedBookedCount > 0 && (
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className={`${KEY_SWATCH_FRAGMENT} ${BOOKED_CELL_FRAGMENT}`}>
            {/* No `text-` class, exactly as in the cell: lucide strokes `currentColor`, so the
              glyph takes BOOKED_CELL_FRAGMENT's `--slate` and the swatch inherits the 3.80:1
              pairing booked-contrast.test.ts measures rather than restating a colour here. */}
            <CalendarClock className="h-2.5 w-2.5" data-testid="key-booked-glyph" />
          </span>
          Booked on your calendar
        </li>
      )}
      {markedBookedCount > 0 && (
        <li className="flex items-center gap-1">
          <span aria-hidden="true" className={`${KEY_SWATCH_FRAGMENT} ${CONFLICT_CELL_FRAGMENT}`}>
            <Check className="h-2.5 w-2.5 text-[var(--ink)]/70" data-testid="key-conflict-check" />
            {/* `bg-current` so the bar inherits CONFLICT_CELL_FRAGMENT's `--ink` (6.50:1 on
              `--accent`), the same trick the cell uses. Without it the swatch is a plain accent
              square, indistinguishable from a slot the participant merely marked free. */}
            <span
              className="absolute inset-x-0.5 bottom-0.5 h-0.5 rounded-full bg-current"
              data-testid="key-conflict-bar"
            />
          </span>
          Marked free, but booked
        </li>
      )}
    </ul>
  )
}

/**
 * What the strip has to report about the action that just happened.
 *
 * Deliberately one discriminated union rather than a spread of count props: every arm describes
 * something the participant did and the counts belong to that act, so a caller cannot supply a
 * skipped count without also saying a fill is what produced it. `unchanged` is the one arm nobody
 * asked for -- a check that found the same booked time it found last time -- and it exists because
 * silence after pressing `Check again` reads as a control that did nothing.
 */
export type StripReport =
  | { kind: 'filled'; markedCount: number; skippedCount: number }
  | { kind: 'cleared'; count: number }
  | { kind: 'kept'; count: number }
  | { kind: 'unchanged' }

export interface CalendarStripProps {
  status: CalendarStatus
  lastSyncedAt: number | null
  // Whether a check is in flight. What is already drawn stays drawn (AC-031), so this changes the
  // strip's words and the actions' inertness, never the grid.
  isChecking: boolean
  // Whether the OAuth hand-off is in flight. Connecting is always a deliberate press, so unlike
  // `isChecking` this state keeps the pressed control on screen rather than removing it out from
  // under the pointer.
  isConnecting: boolean
  // Whether the grid is drawing a busy layer at all. Distinct from `bookedCount === 0`, which is a
  // calendar with nothing in it: this is a read that learned nothing about a calendar (an
  // unlinked participant, AC-044), and the difference is between reporting an empty calendar and
  // claiming one we never saw.
  hasBusyLayer: boolean
  // The range the check actually covered, which the empty-calendar report names (AC-034). Null
  // when the server could not name one, in which case the report does not invent it.
  busyWindow?: DateWindow | null
  // Booked slots drawn on screen, marked or not.
  bookedCount: number
  // Slots the participant has marked free.
  markedCount: number
  // Conflicts still unresolved -- every slot both marked free and booked, minus the ones already
  // kept. Kept slots keep their treatment on the grid but stop being asked about (AC-028).
  conflictCount: number
  // Unmarked, unbooked slots: exactly what the fill would paint. Zero removes the control, since
  // an action that provably changes nothing is not an offer.
  fillableCount: number
  report?: StripReport
  // The on-screen line explaining why the fill is inert, which the inert control points at
  // (AC-032). Owned by the caller because it sits with the grid's other explanatory lines.
  fillReasonId: string
  onConnect: () => void
  onCheckAgain: () => void
  onDismiss: () => void
  onFill: () => void
  onClearConflicts: () => void
  onKeepConflicts: () => void
  now?: () => number
}

const CONNECTED_TITLE = 'Google Calendar connected'
const FILL_LABEL = "Fill in what's free"

const slots = (count: number): string => `${count} ${count === 1 ? 'slot' : 'slots'}`

// `Aug 12–25` within one month, `Aug 12–Sep 2` across two. The month is compared on the ISO
// prefix rather than on the rendered label so a window a year long cannot collapse to a range
// that reads as a fortnight.
const formatWindowRange = (window: DateWindow): string => {
  const monthDay = (iso: string): string => formatShortDate(iso).split(', ')[1]
  const end = monthDay(window.end)
  // The year is compared before the month, because a window may legitimately span one: the
  // retention arm reaches a year forward, and "Aug 20-Aug 20" for twelve months of calendar reads
  // as a single day.
  const sameYear = window.start.slice(0, 4) === window.end.slice(0, 4)
  const sameMonth = sameYear && window.start.slice(0, 7) === window.end.slice(0, 7)
  const endLabel = sameYear ? end : `${end}, ${window.end.slice(0, 4)}`
  return `${monthDay(window.start)}–${sameMonth ? end.split(' ')[1] : endLabel}`
}

// "Slots", never "hours": slots slide (5:30–7, 6–7:30, 6:30–8), so three slots is not three hours.
const fillReport = (markedCount: number, skippedCount: number): string => {
  // Defensive. The control is absent when there is nothing to fill, but a report that says nothing
  // after a press reads as a press that did not register.
  if (markedCount === 0) return 'Nothing left to fill. Nothing on your grid changed.'
  if (skippedCount === 0) return `Marked ${slots(markedCount)} free`
  return `Marked ${slots(markedCount)} free · skipped ${skippedCount} booked ${skippedCount === 1 ? 'slot' : 'slots'}`
}

const reportDetail = (report: StripReport, checked: string): string => {
  if (report.kind === 'filled') return fillReport(report.markedCount, report.skippedCount)
  if (report.kind === 'cleared') return `Cleared ${slots(report.count)} · nothing you marked is booked now`
  if (report.kind === 'kept') {
    return `Kept ${slots(report.count)} · we won't ask again unless you change ${report.count === 1 ? 'it' : 'them'}`
  }
  return `Checked ${checked} · your booked time hasn't changed`
}

// The connected strip with nothing to report. Every branch here is a claim about the calendar, so
// each one is gated on having actually seen it: no layer, or no window to name, and the strip says
// only when the account was last checked.
const restDetail = (props: CalendarStripProps, checked: string): string => {
  if (props.hasBusyLayer && props.bookedCount === 0) {
    const window = props.busyWindow
    if (window) return `Checked ${checked} · nothing booked on your primary calendar, ${formatWindowRange(window)}`
    return `Checked ${checked}`
  }
  if (props.hasBusyLayer && props.markedCount === 0) {
    // A grid where every slot is booked has no fill control, so promising a tap that marks the rest
    // free would point at something that is not on screen.
    if (props.fillableCount === 0) return 'Nothing left to fill. Nothing on your grid changed.'
    return "The grid shows where your calendar says you're booked. One tap marks everything else free."
  }
  if (props.hasBusyLayer) return 'Nothing you marked is booked on your calendar.'
  return `Checked ${checked}`
}

const contentFor = (props: CalendarStripProps): { title: React.ReactNode; detail: React.ReactNode } => {
  const { status, lastSyncedAt, isChecking, isConnecting, conflictCount, report, now = Date.now } = props
  // 0 is the API's never-synced sentinel (get-calendar-callback.ts stamps it at connect), and it is
  // not null, so `?? null` misses it and formatCheckedAgo(0) renders a date in 1970.
  const checked = lastSyncedAt ? formatCheckedAgo(lastSyncedAt, now) : 'just now'

  if (isConnecting) {
    return { detail: 'Connecting to Google Calendar…', title: null }
  }

  if (isChecking) {
    return {
      detail: 'Checking your calendar… The booked squares on screen are from the last check.',
      title: CONNECTED_TITLE,
    }
  }

  if (status === 'not_connected') {
    // The last sentence names the limit of the permission as a fact, not a pledge: calendar.freebusy
    // returns time ranges and nothing else, so the three things people worry about cost us nothing.
    // The middle one is the promise this whole redesign exists to make true -- nothing is marked
    // that was not asked for (AC-033).
    return {
      detail:
        "Connect Google Calendar and we'll show where your primary calendar says you're booked, then fill in the rest in one tap. We never mark anything you didn't ask for. We see when you're busy — never event titles, guests, or locations.",
      title: 'Fill this in from your calendar',
    }
  }

  if (status === 'error') {
    return {
      detail: 'Nothing on your grid changed. Booked squares are hidden until we can check again.',
      title: <>We couldn&apos;t reach Google Calendar</>,
    }
  }

  // A live conflict outranks the report of whatever was resolved a moment ago: the count is the
  // one thing on this strip that is a question rather than a statement (AC-029).
  if (conflictCount > 0) {
    return {
      detail:
        conflictCount === 1
          ? '1 slot you marked free is booked on your calendar.'
          : `${conflictCount} slots you marked free are booked on your calendar.`,
      title: 'Marked free, but booked',
    }
  }

  return { detail: report ? reportDetail(report, checked) : restDetail(props, checked), title: CONNECTED_TITLE }
}

const actionsFor = (props: CalendarStripProps): React.ReactNode => {
  const {
    status,
    isChecking,
    isConnecting,
    conflictCount,
    fillableCount,
    fillReasonId,
    hasBusyLayer,
    onConnect,
    onCheckAgain,
    onDismiss,
    onFill,
    onClearConflicts,
    onKeepConflicts,
  } = props

  // The one control that keeps native `disabled`: its label is its own explanation and the state
  // ends by itself, so nothing is stranded by its leaving the tab order.
  if (isConnecting) {
    return <Chip disabled>Connecting…</Chip>
  }

  // aria-disabled, never disabled: both of these can persist, and a keyboard user tabbed past a
  // control that vanished has no way to find out why nothing happens (AC-032).
  if (isChecking) {
    return (
      <>
        <Chip aria-describedby={fillReasonId} aria-disabled>
          {FILL_LABEL}
        </Chip>
        <Chip aria-disabled>Checking…</Chip>
      </>
    )
  }

  if (status === 'not_connected') {
    return (
      <>
        <Chip onPress={onConnect} primary>
          Connect
        </Chip>
        <Chip onPress={onDismiss}>Not now</Chip>
      </>
    )
  }

  if (status === 'error') {
    return (
      <>
        <Chip aria-describedby={fillReasonId} aria-disabled>
          {FILL_LABEL}
        </Chip>
        <Chip onPress={onCheckAgain} primary>
          Try again
        </Chip>
      </>
    )
  }

  // The review asks one question and offers exactly the two answers to it. `Check again` stands
  // down here on purpose: another check cannot resolve a conflict -- it would return the same
  // booked time and re-ask the same question -- and the fill cannot touch a booked slot, so
  // neither has anything to contribute until this is settled. Both return one tap later.
  if (conflictCount > 0) {
    return (
      <>
        <Chip onPress={onClearConflicts} primary>
          {conflictCount === 1 ? 'Clear this one' : `Clear these ${conflictCount}`}
        </Chip>
        <Chip onPress={onKeepConflicts}>{conflictCount === 1 ? 'Keep it' : 'Keep them'}</Chip>
      </>
    )
  }

  // No Disconnect here at any status. Disconnecting is account-wide, so it lives in the app bar --
  // a control sitting inside one poll would misrepresent how far it reaches.
  return (
    <>
      {/* A fill offered without a layer is Select all wearing the calendar's name: with no busy data
          every unmarked slot counts as fillable, so the control would promise to skip booked hours
          and skip none, having seen none. Withheld until there is a calendar to have consulted. */}
      {hasBusyLayer && fillableCount > 0 && (
        <Chip onPress={onFill} primary>
          {FILL_LABEL}
        </Chip>
      )}
      <Chip onPress={onCheckAgain}>Check again</Chip>
    </>
  )
}

// Presentational only: every value arrives as a prop, so the phase that owns the calendar owns all
// of its state and this renders identically under test without a query client.
export const CalendarStrip = (props: CalendarStripProps): React.ReactNode => {
  const { title, detail } = contentFor(props)

  // One shell for every state so the live region below is the same DOM node across transitions.
  // A live region that is unmounted and remounted with new text is frequently not announced --
  // the region has to already exist for a screen reader to notice its content change (AC-036).
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--hair)] bg-[var(--bone)]/[0.05] px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        {title === null ? null : <p className="text-[13px] font-semibold text-[var(--bone)]">{title}</p>}
        {/* Live: this line is the only account of what the calendar found, what the fill did, and
            how many marks it disagrees with. Nothing else on the page says any of it. */}
        <p aria-live="polite" className="text-xs text-[var(--slate)]" data-testid="calendar-strip-detail">
          {detail}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actionsFor(props)}</div>
    </div>
  )
}
