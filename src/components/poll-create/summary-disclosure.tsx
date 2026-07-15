import React, { useId } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

export const SummaryDisclosure = ({
  label,
  value,
  expanded,
  onToggle,
  panelId,
}: {
  label: string
  value: string
  expanded: boolean
  onToggle: () => void
  panelId: string
}): React.ReactNode => {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        {label}
      </span>
      <div
        aria-labelledby={labelId}
        className="flex items-center justify-between rounded-xl border border-[var(--hair)] bg-[var(--bone)]/[0.04] px-3 py-2"
        role="group"
      >
        <span className="text-sm text-[var(--bone)]">{value}</span>
        <button
          aria-controls={expanded ? panelId : undefined}
          aria-expanded={expanded}
          aria-label={`${expanded ? 'Done editing' : 'Edit'} ${label.toLowerCase()}`}
          className={`text-xs font-bold text-[var(--accent)] ${FOCUS_RING}`}
          onClick={onToggle}
          type="button"
        >
          {expanded ? 'Done' : 'Edit'}
        </button>
      </div>
    </div>
  )
}
