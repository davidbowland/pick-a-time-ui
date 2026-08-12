import React, { useEffect, useRef, useState } from 'react'

import {
  ClearAllDialog,
  CountLine,
  EmptyState,
  NoticeRegion,
  PollList,
  PollRow,
  PruneNotice,
  PruneRegion,
  RecentPollsHeader,
  RecentPollsSection,
  RemovalNotice,
  RestoreNotice,
  ToolButton,
  ToolsRow,
  daysUntilClose,
  expanderLabel,
  joinNames,
  pruneMessage,
} from './elements'
import { RecentPoll } from '@hooks/useRecentPolls'
import { detectViewerTimezone } from '@utils/detectViewerTimezone'

// Six rows is about a phone screen. Past that the list stops being a list you can take in and
// starts being a wall, and the starter below it falls off the screen entirely.
const COLLAPSED_LIMIT = 6

export interface RecentPollsProps {
  // Injected so the "closes in N days" line is assertable without touching the wall clock.
  now?: () => number
  onClear: () => void
  onRemove: (sessionId: string) => void
  onRestore: (poll: RecentPoll) => void
  // Everything comes in as props on purpose. Two mounted `useRecentPolls` instances do NOT share
  // state — the second reports `prunedCount: 0` and one list goes stale after the other's remove —
  // so exactly one owner mounts the hook and hands the pieces down.
  polls: RecentPoll[]
  prunedCount?: number
  // empty and the nameless singular is what renders. See the note in `pruneMessage`.
  prunedPolls?: RecentPoll[]
  timeZone?: string
}

const byRecency = (polls: RecentPoll[]): RecentPoll[] => [...polls].sort((a, b) => b.lastSeen - a.lastSeen)

const RecentPolls = ({
  now = Date.now,
  onClear,
  onRemove,
  onRestore,
  polls,
  prunedCount = 0,
  prunedPolls = [],
  timeZone = detectViewerTimezone(),
}: RecentPollsProps): React.ReactNode => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isClearOpen, setIsClearOpen] = useState(false)
  const [isPruneDismissed, setIsPruneDismissed] = useState(false)
  // Deliberately false on the first render. PruneRegion mounts empty and this flips on the next
  // tick, so the notice arrives as a CHANGE to a live region rather than as a populated new node —
  // the latter is routinely announced by nothing at all.
  const [isPruneAnnounceable, setIsPruneAnnounceable] = useState(false)
  const [removed, setRemoved] = useState<RecentPoll | undefined>(undefined)
  const [restored, setRestored] = useState<RecentPoll | undefined>(undefined)
  const [focusHeadingAt, setFocusHeadingAt] = useState(0)

  const headingRef = useRef<HTMLHeadingElement>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  const dismissRef = useRef<HTMLButtonElement>(null)
  const linkRefs = useRef(new Map<string, HTMLAnchorElement>())

  // A removed row takes its own remove button out of the DOM with it. Without this, focus lands on
  // <body> and the Undo that just appeared is the one thing a keyboard user cannot reach.
  useEffect(() => {
    if (removed !== undefined) undoRef.current?.focus()
  }, [removed])

  // Undo puts the row back, so focus follows it back rather than sitting on a control that no
  // longer exists.
  useEffect(() => {
    if (restored !== undefined) linkRefs.current.get(restored.sessionId)?.focus()
  }, [restored])

  // Dismissing a notice, or clearing the list, destroys the control that had focus. The heading is
  // the top of this surface and carries tabIndex -1 for exactly this (AC-042).
  useEffect(() => {
    if (focusHeadingAt > 0) headingRef.current?.focus()
  }, [focusHeadingAt])

  const setLinkRef =
    (sessionId: string) =>
    (node: HTMLAnchorElement | null): void => {
      if (node === null) {
        linkRefs.current.delete(sessionId)
      } else {
        linkRefs.current.set(sessionId, node)
      }
    }

  const handleRemove = (poll: RecentPoll): void => {
    setRestored(undefined)
    setRemoved(poll)
    onRemove(poll.sessionId)
  }

  const handleUndo = (poll: RecentPoll): void => {
    setRemoved(undefined)
    setRestored(poll)
    onRestore(poll)
  }

  const handleClear = (): void => {
    setIsClearOpen(false)
    setRemoved(undefined)
    setRestored(undefined)
    setFocusHeadingAt((count) => count + 1)
    onClear()
  }

  const handleDismissPrune = (): void => {
    setIsPruneDismissed(true)
    setFocusHeadingAt((count) => count + 1)
  }

  useEffect(() => {
    setIsPruneAnnounceable(true)
  }, [])

  const sorted = byRecency(polls)
  const isCollapsible = sorted.length > COLLAPSED_LIMIT
  const visible = isCollapsible && !isExpanded ? sorted.slice(0, COLLAPSED_LIMIT) : sorted
  const showPrune = prunedCount > 0 && !isPruneDismissed
  const prunedNames = prunedCount > 1 ? joinNames(prunedPolls.map((poll) => poll.pollName)) : ''

  const notice = (): React.ReactNode => {
    if (removed !== undefined) {
      return <RemovalNotice onUndo={() => handleUndo(removed)} pollName={removed.pollName} undoRef={undoRef} />
    }
    if (restored !== undefined) return <RestoreNotice pollName={restored.pollName} />
    return null
  }

  return (
    <RecentPollsSection>
      <RecentPollsHeader headingRef={headingRef} showLede={sorted.length > 0} />
      <PruneRegion>
        {showPrune && isPruneAnnounceable && (
          <PruneNotice
            dismissRef={dismissRef}
            message={pruneMessage(prunedCount, prunedPolls, timeZone)}
            names={prunedNames}
            onDismiss={handleDismissPrune}
          />
        )}
      </PruneRegion>
      <NoticeRegion>{notice()}</NoticeRegion>
      {sorted.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <PollList>
            {visible.map((poll) => (
              <PollRow
                days={daysUntilClose(poll.expiration, now(), timeZone)}
                key={poll.sessionId}
                linkRef={setLinkRef(poll.sessionId)}
                onRemove={() => handleRemove(poll)}
                poll={poll}
              />
            ))}
          </PollList>
          {sorted.length > 1 && <CountLine count={sorted.length} />}
          <ToolsRow>
            {isCollapsible && (
              <ToolButton expanded={isExpanded} onClick={() => setIsExpanded(!isExpanded)}>
                {expanderLabel(sorted.length, isExpanded)}
              </ToolButton>
            )}
            {/* Hidden once the list is empty: nothing to clear, and offering it would be a control
                that confirms a destructive action against nothing. */}
            <ToolButton onClick={() => setIsClearOpen(true)}>Clear all</ToolButton>
          </ToolsRow>
        </>
      )}
      <ClearAllDialog
        count={sorted.length}
        isOpen={isClearOpen}
        onConfirm={handleClear}
        onOpenChange={setIsClearOpen}
      />
    </RecentPollsSection>
  )
}

export default RecentPolls
