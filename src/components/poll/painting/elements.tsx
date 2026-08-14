import React from 'react'

import { Chip } from '@components/ui/chip'
import { formatCheckedAgo } from '@utils/dates'

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

export interface CalendarStripProps {
  status: 'not_connected' | 'connected' | 'error'
  // How many hours this check changed to busy, or null when no check has run or the server skipped
  // one. It counts changes, not conflicts: an hour that was already busy is already correct, so it
  // does not increment. A grid with nothing marked free therefore reports zero however booked the
  // person is. Only a count above zero is a claim we can make, so zero and null render the same.
  markedBusyCount: number | null
  lastSyncedAt: number | null
  usesTimes: boolean
  isChecking: boolean
  // Whether the OAuth hand-off is in flight. Connecting is always a deliberate press, so unlike
  // `isChecking` -- which fires by itself on mount, with nobody looking at a control -- this state
  // keeps the pressed control on screen rather than removing it out from under the pointer.
  isConnecting: boolean
  // Whether the grid has anything for a check to act on. The calendar only ever turns a free cell
  // busy (see markBusyHours in the API), so against a grid with nothing free a check is incapable
  // of changing anything -- and saying "Checked just now" after one reads as a feature that ran and
  // found nothing, which is the opposite of what happened.
  hasFreeCells: boolean
  onConnect: () => void
  onCheckAgain: () => void
  onDismiss: () => void
  now?: () => number
}

const detailFor = (props: CalendarStripProps, checked: string): string => {
  // Zero is folded in with null on purpose. We can report what a check changed; we can never report
  // an absence of conflicts, because "everything was already busy" and "nothing on the calendar
  // clashes" are indistinguishable from here.
  if (!props.markedBusyCount) {
    return `Checked ${checked}`
  }
  if (!props.usesTimes) {
    return `Checked ${checked} · on date-only polls we mark a day busy once 8 hours of it are booked`
  }
  const hours = props.markedBusyCount === 1 ? 'hour' : 'hours'
  return `Checked ${checked} · marked ${props.markedBusyCount} ${hours} busy`
}

const contentFor = (props: CalendarStripProps): { title: React.ReactNode; detail: React.ReactNode } => {
  const { status, lastSyncedAt, isChecking, isConnecting, hasFreeCells, now = Date.now } = props

  if (isConnecting) {
    return { detail: 'Connecting to Google Calendar…', title: null }
  }

  if (isChecking) {
    return { detail: 'Checking your calendar…', title: null }
  }

  if (status === 'not_connected') {
    return {
      // The second sentence names the limit of the permission as a fact, not a pledge:
      // calendar.freebusy returns time ranges and nothing else, so the three things people worry
      // about cost us nothing.
      detail: (
        <>
          Connect Google Calendar and we&apos;ll mark you busy wherever it says you&apos;re booked. We see when
          you&apos;re busy — never event titles, guests, or locations.
        </>
      ),
      title: <>Mark yourself busy where you&apos;re already booked</>,
    }
  }

  if (status === 'error') {
    return { detail: 'Nothing on your grid changed.', title: <>We couldn&apos;t reach Google Calendar</> }
  }

  // Nothing has failed here, so this is guidance rather than an apology: it names the one thing the
  // person has to do, and what they get for doing it. Reporting a check instead would be worse than
  // useless -- a check against an empty grid cannot mark anything, so "Checked just now" would
  // describe a search of an empty room as having found nobody home.
  //
  // The count is what distinguishes an empty grid nobody has filled in from one a check just
  // emptied by marking every free hour busy. Both have no free cells; only the first has nothing to
  // report. Asking for free time right after taking it away would read as the feature undoing
  // itself.
  if (!hasFreeCells && !props.markedBusyCount) {
    return {
      detail: "Mark when you're free and we'll mark you busy wherever your calendar says you're booked.",
      title: 'Google Calendar connected',
    }
  }

  return {
    // 0 is the API's never-synced sentinel (get-calendar-callback.ts stamps it at connect), and it
    // is not null, so `?? null` misses it and formatCheckedAgo(0) renders a date in 1970.
    detail: detailFor(props, lastSyncedAt ? formatCheckedAgo(lastSyncedAt, now) : 'just now'),
    title: 'Google Calendar connected',
  }
}

const actionsFor = (props: CalendarStripProps): React.ReactNode => {
  const { status, isChecking, isConnecting, onConnect, onCheckAgain, onDismiss } = props

  // Disabled rather than removed, and relabelled rather than spinner-only: the live region above
  // carries the announcement, so this only has to stop a second press and stay put while it does.
  if (isConnecting) {
    return <Chip disabled>Connecting…</Chip>
  }
  if (isChecking) {
    return null
  }
  if (status === 'not_connected') {
    return (
      <>
        <Chip onPress={onConnect}>Connect</Chip>
        <Chip onPress={onDismiss}>Not now</Chip>
      </>
    )
  }
  // No Disconnect here at any status. Disconnecting is account-wide, so it lives in the app bar --
  // a control sitting inside one poll would misrepresent how far it reaches.
  return <Chip onPress={onCheckAgain}>{status === 'error' ? 'Try again' : 'Check again'}</Chip>
}

// Presentational only: every value arrives as a prop, so the phase that owns the calendar owns all
// of its state and this renders identically under test without a query client.
export const CalendarStrip = (props: CalendarStripProps): React.ReactNode => {
  const { title, detail } = contentFor(props)

  // One shell for every state so the live region below is the same DOM node across transitions.
  // A live region that is unmounted and remounted with new text is frequently not announced --
  // the region has to already exist for a screen reader to notice its content change.
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--hair)] bg-[var(--bone)]/[0.05] px-3 py-2.5">
      <div className="flex min-w-0 flex-col gap-0.5">
        {title === null ? null : <p className="text-[13px] font-semibold text-[var(--bone)]">{title}</p>}
        {/* Live: an hour a check marked busy looks exactly like one you never marked free, so this
            count is the only explanation of why the grid changed. */}
        <p aria-live="polite" className="text-xs text-[var(--slate)]">
          {detail}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actionsFor(props)}</div>
    </div>
  )
}
