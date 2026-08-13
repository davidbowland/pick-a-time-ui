import { Button } from '@heroui/react'
import { ArrowRight } from 'lucide-react'
import React, { useId } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

// The starter row's height, shared with JoinTrigger's `door` variant so the pair genuinely shares a
// top and bottom edge. Derived: p-1.5 (6px) twice + a 1px border twice + a 44px input — the input
// carries no text-size class, so it inherits line-height 1.5 against a 16px root (a 24px content
// box) plus py-2.5 (10px twice). The Start button is text-sm and computes to 40px, so the input
// governs. Font-metric-dependent: re-measure in a browser if the type scale ever changes.
export const STARTER_ROW_HEIGHT = 58

// An above-the-fold entry point: type a poll name and Start. It shares the name with the mid-page
// create form (lifted in pages/index.tsx) and, on Start, scrolls to and focuses that form. Empty
// Start still scrolls — the form owns the "name required" validation, not this row.
interface HeroStarterBaseProps {
  name: string
  onNameChange: (value: string) => void
  onStart: () => void
  maxLength?: number
}

/**
 * Paired and unpaired are a discriminated union, not two independent optional props, and that is
 * load-bearing rather than fussy typing.
 *
 * The note is the input's accessible description. Paired, the group renders the text and hands the
 * id in; unpaired, the note below is rendered here and carries an id generated here. With the two
 * as separate optionals, a caller could pair without passing an id and ship something *worse* than
 * before this prop existed — visible prose orphaned from the field, and a field with no description
 * at all — and every test would stay green, because nothing dangles and nothing throws. Requiring
 * `noteId` exactly when `isPaired` makes that unrepresentable, and `noteId?: never` on the unpaired
 * arm stops a caller passing an id this component would then duplicate onto its own note.
 */
export type HeroStarterProps = HeroStarterBaseProps &
  ({ isPaired: true; noteId: string } | { isPaired?: false; noteId?: never })

// An above-the-fold entry point: type a poll name and Start. It shares the name with the mid-page
// create form (lifted in pages/index.tsx) and, on Start, scrolls to and focuses that form. Empty
// Start still scrolls — the form owns the "name required" validation, not this row.
export const HeroStarter = ({
  name,
  onNameChange,
  onStart,
  maxLength,
  isPaired = false,
  noteId,
}: HeroStarterProps): React.ReactNode => {
  const fallbackNoteId = useId()
  // Paired, the caller's id is guaranteed by the union above; unpaired, the note below carries the
  // generated one. Never point at an id nothing carries — a dangling reference reads to a screen
  // reader as no description at all.
  const descriptionId = isPaired ? noteId : fallbackNoteId

  return (
    <form
      className={isPaired ? 'w-full' : 'w-full max-w-md'}
      onSubmit={(e) => {
        e.preventDefault()
        onStart()
      }}
    >
      <div className="flex items-center gap-2 rounded-full border border-[var(--accent)]/60 bg-[var(--bone)]/[0.06] p-1.5 shadow-[0_18px_40px_-18px_rgba(0,0,0,0.7)]">
        <input
          aria-describedby={descriptionId}
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
      {isPaired ? null : (
        <p className="mt-3 text-sm text-[var(--copy-color,var(--bone))]/70" id={descriptionId}>
          Free, no account — set the dates on the next step.
        </p>
      )}
    </form>
  )
}
