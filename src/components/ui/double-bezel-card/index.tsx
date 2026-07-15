import React from 'react'

export const DoubleBezelCard = ({
  children,
  className = '',
}: {
  children: React.ReactNode
  className?: string
}): React.ReactNode => (
  <div className="rounded-[2rem] border border-[var(--hair)] bg-[var(--bone)]/[0.06] p-1.5">
    <div
      className={`rounded-[calc(2rem-0.375rem)] bg-[var(--ink)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] ${className}`}
    >
      {children}
    </div>
  </div>
)
