import React from 'react'

export const EyebrowTag = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[var(--accent)]/[0.25] bg-[var(--accent)]/[0.08] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--eyebrow-accent,var(--accent))]">
    <span aria-hidden="true" className="h-[5px] w-[5px] rounded-full bg-[var(--accent)]" />
    {children}
  </span>
)
