import { X } from 'lucide-react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'
import { RecentPoll } from '@hooks/useRecentPolls'
import { formatShortDate } from '@utils/dates'
import { getZonedComponents } from '@utils/timezone'

// The app's card idiom (poll/onboarding/elements.tsx:22). There is no HeroUI card — the component
// stylesheet list at src/assets/css/index.css:28-46 is exhaustive, and no card is on it.
const CARD_CLASS = 'rounded-2xl border border-[var(--hair)] bg-[var(--bone)]/10'

// --hair is rgba(148,148,163,0.22), which composites to roughly 1.6:1 over --ink. That is fine as
// the edge of a card (decoration) and NOT fine as the boundary that identifies a control, which
// SC 1.4.11 holds to 3:1. Anything that reads as a control gets --slate, exactly as --field-border
// already does at src/assets/css/index.css:101.
const CONTROL_CLASS = `inline-flex min-h-9 items-center justify-center gap-1.5 rounded-full border border-[var(--slate)] px-3 py-1.5 text-sm font-semibold text-[var(--bone)] hover:bg-[var(--bone)]/[0.12] motion-safe:transition-colors motion-safe:duration-150 ${FOCUS_RING}`

// Exported for `clear-all-dialog.tsx`, which is loaded lazily from this module. That is an import
// cycle on paper; it is inert in practice because the dynamic import cannot begin evaluating until
// long after this module has finished, and it keeps the dialog's styling beside its siblings.
export const DIALOG_BUTTON_CLASS = `rounded-full px-4 text-sm font-bold ${FOCUS_RING}`

// ---------------------------------------------------------------------------
// Copy builders. Pure, so the approved strings are assertable without a render.
// ---------------------------------------------------------------------------

const isoToUtcMs = (iso: string): number => {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

// `expiration` is epoch SECONDS (useRecentPolls.ts:9-12); `nowMs` is epoch milliseconds, as
// `Date.now` returns. Treating the two alike puts every close date in the year 55000, which reads
// as "in 17,000,000 days" rather than failing outright.
export const daysUntilClose = (expirationSeconds: number, nowMs: number, timeZone: string): number => {
  const today = getZonedComponents(nowMs, timeZone).date
  const closes = getZonedComponents(expirationSeconds * 1000, timeZone).date
  return Math.round((isoToUtcMs(closes) - isoToUtcMs(today)) / 86_400_000)
}

// One phrase feeds both the visible meta line and the row's accessible name, so the two can never
// drift into saying different things about the same poll.
export const closesPhrase = (days: number): string => {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

export const rowMeta = (poll: RecentPoll, days: number): string => `Closes ${closesPhrase(days)} · as ${poll.name}`

// Leads with the verb: a screen-reader user arrowing the list hears what activating the row does
// before hearing which row it is.
// A comma, not an em dash, before "closes". Poll names routinely contain an em dash of their own --
// "Board meeting — Q3", "Cabin trip — August" are the design's own samples -- and the template's
// dash then collides with the name's, so the label read "Open Cabin trip — August — closes in 12
// days". Two dashes in one sentence, one of them structural and one of them part of a title, is
// unparseable read aloud.
export const rowLabel = (poll: RecentPoll, days: number): string =>
  `Open ${poll.pollName}, closes ${closesPhrase(days)}, you're ${poll.name}`

// Entries carry `?id={userId}` so re-entry does not depend on the path-scoped 14-day cookie
// (AC-015). `src/components/poll/index.tsx:28-37` reads it and strips it via replaceState.
export const entryHref = (poll: RecentPoll): string =>
  `/p/${encodeURIComponent(poll.sessionId)}?id=${encodeURIComponent(poll.userId)}`

// Plural only, deliberately: a one-poll list needs no count, so `CountLine` is never rendered
// below two and a singular form here would be a branch nothing can reach.
export const countLine = (count: number): string => `${count} polls on this device`

export const expanderLabel = (count: number, expanded: boolean): string =>
  expanded ? 'Show fewer' : `Show all ${count} polls`

export const clearDialogBody = (count: number): string =>
  count === 1
    ? `This removes it from this device. The poll itself stays open — you'd need its link again to get back in.`
    : `This removes all ${count} polls from this device. The polls themselves stay open — you'd need their links again to get back in.`

export const removalNotice = (pollName: string): string =>
  `Removed ${pollName} from your polls. The link still works if you have it.`

export const restoreNotice = (pollName: string): string => `${pollName} is back in your polls.`

// `formatShortDate` prints "Fri, Aug 8"; the notice wants only "Aug 8". Reusing it keeps one set of
// month names in the app rather than a second copy that can drift.
const closedOnDate = (poll: RecentPoll, timeZone: string): string =>
  formatShortDate(getZonedComponents(poll.expiration * 1000, timeZone).date).replace(/^\w{3}, /, '')

// AC-042: the notice has to agree in number with what was actually pruned. `count` is authoritative
// because it is what the store measured; `pruned` only supplies names, and the hook does not
export const pruneMessage = (count: number, pruned: RecentPoll[], timeZone: string): string => {
  if (count !== 1) return `${count} polls closed, so they're no longer in your polls.`
  if (pruned.length === 1)
    return `${pruned[0].pollName} closed on ${closedOnDate(pruned[0], timeZone)}, so it's no longer in your polls.`
  return `A poll closed, so it's no longer in your polls.`
}

export const joinNames = (names: string[]): string => {
  if (names.length < 2) return names.join('')
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

// The safe-area padding matters in the installed app, where the page runs edge to edge and a
// display cutout would otherwise sit on top of the remove controls (AC-027).
export const RecentPollsSection = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <section
    aria-labelledby="recent-polls-heading"
    className="mx-auto w-full max-w-[720px] pt-8 pb-[max(2rem,env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]"
  >
    {children}
  </section>
)

export const RecentPollsHeader = ({
  headingRef,
  showLede,
}: {
  headingRef: React.Ref<HTMLHeadingElement>
  showLede: boolean
}): React.ReactNode => (
  <>
    {/* tabIndex -1 makes this a landing spot for focus when a notice is dismissed, so focus is
        never handed back to <body> (AC-042). */}
    <h1
      className="text-3xl text-[var(--bone)] sm:text-4xl"
      id="recent-polls-heading"
      ref={headingRef}
      style={{ fontFamily: 'var(--font-display)' }}
      tabIndex={-1}
    >
      Your polls
    </h1>
    {showLede && (
      <p className="mt-2 text-sm text-[var(--slate)]">
        Pick up where you left off. These live on this device only, and each one goes away when its poll closes.
      </p>
    )}
  </>
)

export const PollList = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  // role="list" is not redundant here. WebKit drops the implicit list/listitem roles as soon as
  // `list-style: none` computes, and it computes twice over: from `list-none` and from Tailwind v4's
  // preflight, which sets it on every ul. Safari with VoiceOver is the installed-app case this
  // feature is aimed at, and jsdom models none of it -- so the test asserting list semantics passes
  // either way. The explicit roles are what actually hold AC-024.
  <ul className="mt-6 flex list-none flex-col gap-3" role="list">
    {children}
  </ul>
)

export interface PollRowProps {
  days: number
  linkRef: React.Ref<HTMLAnchorElement>
  onRemove: () => void
  poll: RecentPoll
}

export const PollRow = ({ days, linkRef, onRemove, poll }: PollRowProps): React.ReactNode => (
  <li className={`flex items-center gap-3 p-4 ${CARD_CLASS}`} role="listitem">
    {/* The remove button is a sibling of the link, never a descendant: a button inside an anchor is
        invalid and taps land on whichever wins. */}
    <Link
      aria-label={rowLabel(poll, days)}
      className={`flex min-w-0 flex-1 flex-col gap-1 rounded-xl ${FOCUS_RING}`}
      href={entryHref(poll)}
      ref={linkRef}
    >
      <span className="font-semibold break-words text-[var(--bone)]">{poll.pollName}</span>
      <span className="text-xs text-[var(--slate)]">{rowMeta(poll, days)}</span>
    </Link>
    <button
      aria-label={`Remove ${poll.pollName} from your polls`}
      className={`h-9 w-9 shrink-0 ${CONTROL_CLASS} px-0`}
      onClick={onRemove}
      type="button"
    >
      <X aria-hidden="true" className="h-4 w-4" />
    </button>
  </li>
)

// One live region, mounted for the life of the list, so a notice inserted into it is announced.
// A region that appears at the same moment as its text is frequently missed by screen readers.
export const NoticeRegion = ({ children }: { children?: React.ReactNode }): React.ReactNode => (
  <div aria-live="polite" className="mt-4 empty:mt-0" role="status">
    {children}
  </div>
)

// Wraps the prune notice for the same reason NoticeRegion wraps the removal one: prunedCount is
// known on the very first render, so rendering region and text together mounts a populated live
// region -- which assistive technology reads as a new node rather than a changed region, and
// announces nothing. The region mounts empty and the notice arrives on a later update (AC-042).
export const PruneRegion = ({ children }: { children?: React.ReactNode }): React.ReactNode => (
  <div aria-live="polite" className="empty:hidden" role="status">
    {children}
  </div>
)

// Visible, not sr-only. Removal takes the link off the device and nothing on the server changes,
// so Undo is the only way back from a mis-tap — hiding it from sighted users would make the one
// destructive action on this surface the one action they cannot reverse.
export const RemovalNotice = ({
  onUndo,
  pollName,
  undoRef,
}: {
  onUndo: () => void
  pollName: string
  undoRef: React.Ref<HTMLButtonElement>
}): React.ReactNode => (
  <div className={`flex flex-wrap items-center justify-between gap-3 p-4 ${CARD_CLASS}`}>
    <p className="min-w-0 flex-1 text-sm text-[var(--bone)]">{removalNotice(pollName)}</p>
    <button
      aria-label={`Undo removing ${pollName}`}
      className={CONTROL_CLASS}
      onClick={onUndo}
      ref={undoRef}
      type="button"
    >
      Undo
    </button>
  </div>
)

export const RestoreNotice = ({ pollName }: { pollName: string }): React.ReactNode => (
  <p className={`p-4 text-sm text-[var(--bone)] ${CARD_CLASS}`}>{restoreNotice(pollName)}</p>
)

export const PruneNotice = ({
  dismissRef,
  message,
  names,
  onDismiss,
}: {
  dismissRef: React.Ref<HTMLButtonElement>
  message: string
  names: string
  onDismiss: () => void
}): React.ReactNode => (
  // No role here: PruneRegion above owns the live region. Nesting two would announce twice.
  <div className={`mt-6 p-4 ${CARD_CLASS}`}>
    <p className="text-sm text-[var(--bone)]">{message}</p>
    {names !== '' && <p className="mt-1 text-xs text-[var(--slate)]">{names}</p>}
    <button className={`mt-3 ${CONTROL_CLASS}`} onClick={onDismiss} ref={dismissRef} type="button">
      Got it
    </button>
  </div>
)

export const EmptyState = (): React.ReactNode => (
  <div className={`mt-6 p-6 ${CARD_CLASS}`}>
    <h2 className="text-lg font-semibold text-[var(--bone)]">No polls on this device yet.</h2>
    <p className="mt-1 text-sm text-[var(--slate)]">Open a poll link and it shows up here.</p>
  </div>
)

export const ToolsRow = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="mt-4 flex flex-wrap items-center gap-3">{children}</div>
)

export const ToolButton = ({
  children,
  expanded,
  onClick,
}: {
  children: React.ReactNode
  expanded?: boolean
  onClick: () => void
}): React.ReactNode => (
  <button aria-expanded={expanded} className={CONTROL_CLASS} onClick={onClick} type="button">
    {children}
  </button>
)

export const CountLine = ({ count }: { count: number }): React.ReactNode => (
  <p className="mt-4 text-xs text-[var(--slate)]">{countLine(count)}</p>
)

const ClearAllDialogImpl = dynamic(async () => (await import('./clear-all-dialog')).ClearAllDialog, {
  ssr: false,
})

// Rendering `null` while closed is what keeps the chunk unfetched: `dynamic()` starts its import on
// mount, so leaving the wrapper mounted-but-closed would download the dialog on every visit and
// defeat the split.
export const ClearAllDialog = ({
  count,
  isOpen,
  onConfirm,
  onOpenChange,
}: {
  count: number
  isOpen: boolean
  onConfirm: () => void
  onOpenChange: (open: boolean) => void
}): React.ReactNode =>
  isOpen ? <ClearAllDialogImpl count={count} isOpen={isOpen} onConfirm={onConfirm} onOpenChange={onOpenChange} /> : null
