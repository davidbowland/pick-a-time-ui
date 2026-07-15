import { ChevronDown, ChevronUp } from 'lucide-react'
import React from 'react'

function preJoinCopy(pollName: string, dateCount: number): React.ReactNode {
  return (
    <>
      You&apos;ve been invited to <strong>{pollName}</strong>. No account needed — jump in, mark which of these{' '}
      {dateCount} date{dateCount === 1 ? ' works' : 's work'} for you, and everyone&apos;s overlap updates as people
      join.
    </>
  )
}

// Once a voter has already joined, "you've been invited... jump in" is stale — they already did
// both. This describes the ongoing mechanic instead, worded to stay accurate whether they're
// actively marking their own availability right now or just looking at the overlap.
function joinedCopy(dateCount: number): React.ReactNode {
  return (
    <>
      Mark which of these {dateCount} date{dateCount === 1 ? ' works' : 's work'} for you. Everyone&apos;s overlap
      updates as people join.
    </>
  )
}

export const IntroExplainer = ({
  pollName,
  dateCount,
  onDismiss,
}: {
  pollName: string
  dateCount: number
  onDismiss: () => void
}): React.ReactNode => (
  <div className="rounded-2xl border border-[var(--hair)] bg-[var(--bone)]/10 p-4 text-sm text-[var(--bone)]">
    <p>{preJoinCopy(pollName, dateCount)}</p>
    <button
      className="mt-2 text-xs font-semibold text-[var(--accent)] underline underline-offset-2"
      onClick={onDismiss}
      type="button"
    >
      Got it
    </button>
  </div>
)

export const WhatIsThisToggle = ({
  isOpen,
  onToggle,
  pollName,
  dateCount,
  hasJoined,
}: {
  isOpen: boolean
  onToggle: () => void
  pollName: string
  dateCount: number
  hasJoined: boolean
}): React.ReactNode => (
  <div>
    <button
      aria-expanded={isOpen}
      className="flex items-center gap-1 text-xs font-medium text-[var(--slate)]"
      onClick={onToggle}
      type="button"
    >
      What is this?
      {isOpen ? (
        <ChevronUp aria-hidden="true" className="h-3 w-3" />
      ) : (
        <ChevronDown aria-hidden="true" className="h-3 w-3" />
      )}
    </button>
    {isOpen && (
      <p className="mt-2 max-w-[40ch] text-xs text-[var(--slate)]">
        {hasJoined ? joinedCopy(dateCount) : preJoinCopy(pollName, dateCount)}
      </p>
    )}
  </div>
)
