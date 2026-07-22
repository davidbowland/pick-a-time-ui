import { FieldError, Input, Label, TextField } from '@heroui/react'
import { motion, useReducedMotion } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import React, { useId } from 'react'

import { Chip } from '@components/ui/chip'
import { EyebrowTag } from '@components/ui/eyebrow-tag'
import { FOCUS_RING } from '@components/ui/focus-ring'

const SETTLED_BOX_SHADOW = '0 0 0 0 rgba(63,174,138,0)'

const STEPPER_BUTTON_CLASS = `flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hair)] bg-[var(--bone)]/[0.05] text-[var(--bone)] hover:bg-[var(--bone)]/[0.1] ${FOCUS_RING}`

export const CreateCard = ({ children }: { children: React.ReactNode }): React.ReactNode => {
  // The card announces itself as it scrolls into view: a one-time fade + rise layered over the
  // existing accent-glow settle, so it reads as a live surface assembling rather than a static
  // screenshot. `once: true` means it settles once with no re-trigger or bounce, and the whole
  // card moves as a single unit so a pre-filled name never jitters. Reduced-motion users skip the
  // entrance entirely (`initial={false}` renders the settled state) — the `motion-reduce:` class
  // still pins the box-shadow with no JS/SSR/hydration risk.
  const reduce = useReducedMotion()
  return (
    <motion.div
      animate={{ boxShadow: SETTLED_BOX_SHADOW }}
      className="rounded-[2rem] border border-[var(--hair)] bg-[var(--bone)]/[0.06] p-1.5 motion-reduce:[box-shadow:0_0_0_0_rgba(63,174,138,0)]!"
      initial={reduce ? false : { boxShadow: '0 0 0 4px rgba(63,174,138,0.35)', opacity: 0, y: 14 }}
      transition={{ duration: 1.1, ease: [0.32, 0.72, 0, 1] }}
      // Trigger as soon as any sliver is in view (not 50%), so a form taller than a short mobile
      // viewport — e.g. after the hero's Start scrolls it to the top — can never strand at opacity 0.
      viewport={{ once: true, amount: 0.1 }}
      whileInView={{ boxShadow: SETTLED_BOX_SHADOW, opacity: 1, y: 0 }}
    >
      <div className="rounded-[calc(2rem-0.375rem)] bg-[var(--ink)] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="flex flex-col gap-[18px]">{children}</div>
      </div>
    </motion.div>
  )
}

export const CreateCardHeader = (): React.ReactNode => (
  <div className="flex flex-col gap-2">
    <EyebrowTag fixedAccent>New poll</EyebrowTag>
    <h2 className="text-2xl text-[var(--bone)]" style={{ fontFamily: 'var(--font-display)' }}>
      Set it up
    </h2>
  </div>
)

const WEEKDAY_ABBR = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WEEKDAY_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

type PollNameFieldProps = {
  value: string
  error?: string
  onChange: (value: string) => void
  maxLength?: number
}

export const PollNameField = React.forwardRef<HTMLInputElement, PollNameFieldProps>(
  ({ value, error, onChange, maxLength }, ref): React.ReactNode => (
    <TextField isInvalid={!!error}>
      <Label>Poll name</Label>
      <Input
        className="border border-[var(--slate)]/70 bg-[var(--bone)]/[0.04] text-[var(--bone)] placeholder:text-[var(--slate)]"
        maxLength={maxLength}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g. Movie night"
        ref={ref}
        value={value}
      />
      {error && <FieldError>{error}</FieldError>}
    </TextField>
  ),
)
PollNameField.displayName = 'PollNameField'

export const WeekdayPicker = ({
  selected,
  onChange,
}: {
  selected: number[]
  onChange: (weekdays: number[]) => void
}): React.ReactNode => {
  const labelId = useId()

  const toggle = (day: number): void => {
    const next = selected.includes(day) ? selected.filter((d) => d !== day) : [...selected, day]
    onChange(next.sort((a, b) => a - b))
  }

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        Which days?
      </span>
      <div aria-labelledby={labelId} className="flex flex-wrap gap-1.5" role="group">
        {WEEKDAY_ABBR.map((letter, day) => (
          <Chip aria-label={WEEKDAY_FULL[day]} key={day} onPress={() => toggle(day)} selected={selected.includes(day)}>
            {letter}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export const WeekCountStepper = ({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}): React.ReactNode => {
  const labelId = useId()
  return (
    <div className="flex shrink-0 flex-col gap-2">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        How many weeks?
      </span>
      <div aria-labelledby={labelId} className="flex items-center gap-4" role="group">
        <button
          aria-label="Fewer weeks"
          className={STEPPER_BUTTON_CLASS}
          onClick={() => onChange(Math.max(1, value - 1))}
          type="button"
        >
          <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
        <span
          aria-live="polite"
          className="whitespace-nowrap text-[var(--bone)]"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {value} week{value === 1 ? '' : 's'}
        </span>
        <button
          aria-label="More weeks"
          className={STEPPER_BUTTON_CLASS}
          onClick={() => onChange(Math.min(12, value + 1))}
          type="button"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}
