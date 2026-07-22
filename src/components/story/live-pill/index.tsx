import React from 'react'

// A persistent "this is interactive" marker for the one live form on the landing page. The label
// is real text (never color-alone); the pulsing dot is decorative (`aria-hidden`) and gated to
// non-reduced-motion users via `motion-safe:`. Reuses EyebrowTag's AA-verified accent-on-ink pairing.
export const LivePill = (): React.ReactNode => (
  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--ink)] px-3 py-1 text-[10px] font-bold tracking-[0.2em] text-[var(--accent)] uppercase">
    <span aria-hidden="true" className="h-[6px] w-[6px] rounded-full bg-[var(--accent)] motion-safe:animate-pulse" />
    Live · try it now
  </span>
)
