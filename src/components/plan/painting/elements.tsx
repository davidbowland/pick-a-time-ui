import React from 'react'

const buttonClassName =
  'rounded-full border border-white/[0.09] bg-white/[0.05] px-3 py-1 text-xs text-[#D4D4D4] ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0a0a0b]'

export const Toolbar = ({ onAllDay, onClear }: { onAllDay: () => void; onClear: () => void }): React.ReactNode => (
  <div className="flex gap-2">
    <button className={buttonClassName} onClick={onAllDay} type="button">
      Mark all day
    </button>
    <button className={buttonClassName} onClick={onClear} type="button">
      Clear all
    </button>
  </div>
)
