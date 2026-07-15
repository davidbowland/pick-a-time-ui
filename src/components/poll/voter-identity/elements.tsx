import { Input } from '@heroui/react'
import { ArrowLeftRight, Pencil, X } from 'lucide-react'
import React, { useEffect, useId, useRef } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

const ACTION_BUTTON_CLASS = `flex h-8 w-8 items-center justify-center rounded-full border border-[var(--hair)] bg-[var(--bone)]/[0.05] text-[var(--slate)] hover:bg-[var(--bone)]/[0.1] disabled:opacity-40 ${FOCUS_RING}`

export const EditNameButton = ({
  onPress,
  ref,
}: {
  onPress: () => void
  ref?: React.Ref<HTMLButtonElement>
}): React.ReactNode => (
  <button aria-label="Edit name" className={ACTION_BUTTON_CLASS} onClick={onPress} ref={ref} type="button">
    <Pencil className="h-3.5 w-3.5" />
  </button>
)

export const NotYouButton = ({ onPress }: { onPress: () => void }): React.ReactNode => (
  <button
    aria-label="This isn't me"
    className={ACTION_BUTTON_CLASS}
    onClick={onPress}
    title="Not you? Switch and pick again"
    type="button"
  >
    <ArrowLeftRight className="h-3.5 w-3.5" />
  </button>
)

export const ErrorMessage = ({ message, id }: { message: string; id?: string }): React.ReactNode => (
  <p className="text-sm text-red-400" id={id} role="alert">
    {message}
  </p>
)

export const NameEditForm = ({
  value,
  onChange,
  onBlur,
  onCancel,
  isSaving,
  maxLength,
  errorMessage,
}: {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  onCancel: () => void
  isSaving: boolean
  maxLength?: number
  errorMessage?: string
}): React.ReactNode => {
  const inputRef = useRef<HTMLInputElement>(null)
  const inputId = useId()
  const errorId = useId()

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="flex flex-col gap-1">
      <div
        className="flex items-center gap-2"
        onBlur={(e) => {
          // Only treat this as "leaving the control" when the newly focused element is outside
          // both the input and the Cancel button — moving between the two (by Tab, or by
          // clicking/tapping Cancel) is normal in-control navigation, not a commit signal. This
          // also means Cancel never races a blur-triggered save, on any input method: focus
          // moving to it is always still "inside," so no save fires, and its own onClick handles
          // the actual cancel.
          if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
          onBlur()
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Your name
        </label>
        <Input
          aria-describedby={errorMessage ? errorId : undefined}
          aria-invalid={!!errorMessage}
          className="h-8 w-32 border border-[var(--slate)]/70 bg-[var(--bone)]/[0.04] text-sm text-[var(--bone)] disabled:opacity-40"
          disabled={isSaving}
          id={inputId}
          maxLength={maxLength}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Guarded the same way the Cancel button already is (disabled below while isSaving):
            // a save already in flight has to resolve first. Without this, Escape could show an
            // apparently-successful cancel (old name, form closed) moments before the in-flight
            // PATCH completes anyway and invalidateQueries silently reinstates the "cancelled" edit.
            if (e.key === 'Escape' && !isSaving) onCancel()
          }}
          ref={inputRef}
          value={value}
        />
        <button
          aria-label="Cancel editing name"
          className={ACTION_BUTTON_CLASS}
          disabled={isSaving}
          onClick={onCancel}
          type="button"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {errorMessage && <ErrorMessage id={errorId} message={errorMessage} />}
    </div>
  )
}
