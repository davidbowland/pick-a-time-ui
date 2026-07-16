import React from 'react'

// `--eyebrow-accent` is recomputed by SkyBackground against the *page's* scroll-interpolated
// night/day background. That's only correct where the tag sits directly on that background.
// Where it sits on a background that doesn't move with scroll (e.g. the permanently-dark
// poll-create card), pass `fixedAccent` to pin it to `--accent` (AA against `--ink`) instead.
export const EyebrowTag = ({
  children,
  fixedAccent = false,
}: {
  children: React.ReactNode
  fixedAccent?: boolean
}): React.ReactNode => (
  <span
    className={`inline-flex w-fit items-center gap-2 rounded-full border border-[var(--accent)]/[0.25] bg-[var(--accent)]/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${fixedAccent ? 'text-[var(--accent)]' : 'text-[var(--eyebrow-accent,var(--accent))]'}`}
  >
    <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-[var(--accent)]" />
    {children}
  </span>
)
