import { Button } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

// An above-the-fold entry point: type a poll name and Start. It shares the name with the mid-page
// create form (lifted in pages/index.tsx) and, on Start, scrolls to and focuses that form. Empty
// Start still scrolls — the form owns the "name required" validation, not this row.
export const HeroStarter = ({
  name,
  onNameChange,
  onStart,
  maxLength,
}: {
  name: string
  onNameChange: (value: string) => void
  onStart: () => void
  maxLength?: number
}): React.ReactNode => (
  <form
    className="w-full max-w-md"
    onSubmit={(e) => {
      e.preventDefault()
      onStart()
    }}
  >
    <div className="flex items-center gap-2 rounded-full border border-[var(--accent)]/60 bg-[var(--bone)]/[0.06] p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]">
      <input
        aria-label="Name your poll"
        className={`min-w-0 flex-1 rounded-full bg-transparent px-5 py-2.5 text-[var(--bone)] placeholder:text-[var(--slate)] focus:outline-none ${FOCUS_RING}`}
        maxLength={maxLength}
        onChange={(e) => onNameChange(e.target.value)}
        placeholder="Name your poll"
        value={name}
      />
      <Button
        className={`inline-flex h-auto min-w-0 shrink-0 items-center gap-1.5 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-bold text-[var(--ink)] ${FOCUS_RING}`}
        type="submit"
      >
        Start
        <ArrowRight aria-hidden="true" size={16} />
      </Button>
    </div>
    <p className="mt-3 text-sm text-[var(--copy-color,var(--bone))]/70">
      Free, no account — set the dates on the next step.
    </p>
  </form>
)
