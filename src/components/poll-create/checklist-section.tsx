import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

export const ChecklistSection = ({
  stepNumber,
  title,
  isOpen,
  isDone,
  summary,
  onEdit,
  children,
}: {
  stepNumber: number
  title: string
  isOpen: boolean
  isDone: boolean
  summary?: React.ReactNode
  onEdit?: () => void
  children: React.ReactNode
}): React.ReactNode => (
  <div className="rounded-2xl border border-[var(--hair)]">
    <div className={`flex items-center gap-2 px-4 py-3 ${isOpen || !isDone ? 'border-b border-[var(--hair)]' : ''}`}>
      <span
        aria-hidden="true"
        className={`flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          isDone ? 'bg-[var(--accent)] text-[var(--ink)]' : 'border border-[var(--hair)] text-[var(--accent)]'
        }`}
      >
        {isDone ? '✓' : stepNumber}
      </span>
      <span className="shrink-0 text-sm font-bold whitespace-nowrap text-[var(--bone)]">{title}</span>
      {isDone && (
        <>
          <span className="min-w-0 flex-1 truncate text-xs text-[var(--slate)]">{summary}</span>
          {onEdit && (
            <button
              aria-label={`Edit ${title.toLowerCase()}`}
              className={`shrink-0 text-xs font-bold text-[var(--accent)] ${FOCUS_RING}`}
              onClick={onEdit}
              type="button"
            >
              Edit
            </button>
          )}
        </>
      )}
    </div>
    {isOpen && <div className="flex flex-col gap-[18px] px-4 py-4">{children}</div>}
    {!isOpen && !isDone && (
      <p className="px-4 py-4 text-xs text-[var(--slate)]">Unlocks once you finish the step above.</p>
    )}
  </div>
)
