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
