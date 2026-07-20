import React from 'react'

// The pill fills solid with `--copy-color` — the same guaranteed-AA-against-the-page neutral
// SkyBackground already publishes for body copy — rather than a translucent accent tint. That
// turns "does the green read against whatever's behind it" into a much smaller problem: the
// green (`--eyebrow-accent`, set below) only ever has to contrast a small fixed set of chip
// colors (ink/bone, or black/white in the scroll dead zone), not the page background directly.
// Text, border, and the dot all share that one derived color, so a chip that's legible at all
// guarantees all three are too — no separate glow/ring hack needed for the dot.
//
// `--eyebrow-accent` is recomputed by SkyBackground against the *page's* scroll-interpolated
// night/day background. That's only correct where the tag sits directly on that background.
// Where it sits on a background that doesn't move with scroll (e.g. the permanently-dark
// poll-create card), pass `fixedAccent` to pin it to `--accent` on an `--ink` chip instead.
export const EyebrowTag = ({
  children,
  fixedAccent = false,
}: {
  children: React.ReactNode
  fixedAccent?: boolean
}): React.ReactNode => (
  <span
    className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
      fixedAccent
        ? 'border-[var(--accent)] bg-[var(--ink)] text-[var(--accent)]'
        : 'border-[var(--eyebrow-accent,var(--accent))] bg-[var(--copy-color,var(--ink))] text-[var(--eyebrow-accent,var(--accent))]'
    }`}
  >
    <span
      aria-hidden="true"
      className={`h-[5px] w-[5px] rounded-full ${fixedAccent ? 'bg-[var(--accent)]' : 'bg-[var(--eyebrow-accent,var(--accent))]'}`}
    />
    {children}
  </span>
)
