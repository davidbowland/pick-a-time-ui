import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

// px-3 py-1.5 around a text-xs label (12px on a 16px line) is a 26×30px target at a 16px root,
// clearing WCAG 2.2 SC 2.5.8's 24×24 AA minimum. SC 2.5.5's 44×44 is Level AAA, not the bar here.
const baseClass = `rounded-xl border px-3 py-1.5 text-xs font-bold transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-30 disabled:active:scale-100 aria-disabled:opacity-30 aria-disabled:active:scale-100 ${FOCUS_RING}`

function skinFor(accented: boolean | undefined): string {
  return accented
    ? 'border-transparent bg-[var(--accent)] text-[var(--ink)] hover:opacity-90'
    : 'border-[var(--bone)]/20 bg-[var(--bone)]/[0.08] text-[var(--bone)] hover:border-[var(--bone)]/35 hover:bg-[var(--bone)]/[0.14]'
}

// The accent skin has two reasons to appear and they mean opposite things. `selected` is a toggle
// state and says so with aria-pressed; `primary` is emphasis on an action that has no state to
// report -- Connect, Try again, Fill in what's free. So they are mutually exclusive at the type
// level: either combination of skin and semantics would lie about the control. A JS caller that
// slips both past the compiler gets `selected`'s aria-pressed, because dropping it hides a real
// state while dropping `primary` costs only emphasis.
type Emphasis = { primary?: boolean; selected?: never } | { primary?: never; selected?: boolean }

export const Chip = ({
  children,
  selected,
  primary,
  onPress,
  as = 'button',
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedby,
  'aria-disabled': ariaDisabled,
  disabled,
}: {
  children: React.ReactNode
  onPress?: () => void
  as?: 'button' | 'span'
  'aria-label'?: string
  'aria-describedby'?: string
  // Inert but still reachable: the control keeps its place in the tab order so a keyboard user
  // lands on it and hears why, from the on-screen text `aria-describedby` names. Native `disabled`
  // is the right tool only where the label is its own explanation and the state ends by itself
  // ("Connecting…", mid-OAuth); anywhere the reason lives elsewhere and can persist -- a calendar
  // check running, or one that failed -- removing the control from the tab order would strand that
  // user with no way to find out why nothing happens (AC-032).
  'aria-disabled'?: boolean
  disabled?: boolean
} & Emphasis): React.ReactNode => {
  if (as === 'span') {
    return <span className={`${baseClass} ${skinFor(selected || primary)}`}>{children}</span>
  }
  return (
    <button
      aria-describedby={ariaDescribedby}
      aria-disabled={ariaDisabled}
      aria-label={ariaLabel}
      aria-pressed={selected === undefined ? undefined : selected}
      className={`${baseClass} ${skinFor(selected || primary)}`}
      disabled={disabled}
      onClick={ariaDisabled ? undefined : onPress}
      type="button"
    >
      {children}
    </button>
  )
}
