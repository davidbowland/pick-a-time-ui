import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

const baseClass = `rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-30 disabled:active:scale-100 ${FOCUS_RING}`

function skinFor(selected: boolean | undefined): string {
  return selected
    ? 'border-transparent bg-[var(--accent)] text-[var(--ink)] hover:opacity-90'
    : 'border-[var(--bone)]/20 bg-[var(--bone)]/[0.08] text-[var(--bone)] hover:border-[var(--bone)]/35 hover:bg-[var(--bone)]/[0.14]'
}

export const Chip = ({
  children,
  selected,
  onPress,
  as = 'button',
  'aria-label': ariaLabel,
  disabled,
}: {
  children: React.ReactNode
  selected?: boolean
  onPress?: () => void
  as?: 'button' | 'span'
  'aria-label'?: string
  disabled?: boolean
}): React.ReactNode => {
  if (as === 'span') {
    return <span className={`${baseClass} ${skinFor(selected)}`}>{children}</span>
  }
  return (
    <button
      aria-label={ariaLabel}
      aria-pressed={selected === undefined ? undefined : selected}
      className={`${baseClass} ${skinFor(selected)}`}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      {children}
    </button>
  )
}
