import React from 'react'

import { PillButton } from '@components/ui/pill-button'

export const ClosingFooter = ({ onBackToStart }: { onBackToStart: () => void }): React.ReactNode => (
  <footer className="px-5 py-32 text-center">
    <div className="mx-auto max-w-[640px]">
      <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-medium text-[var(--copy-color,var(--bone))]">
        That&apos;s the shape of it.
      </h2>
      <p className="mt-4 text-[1.02rem] leading-relaxed text-[var(--copy-color,var(--bone))]/75">
        Six moments, one continuous idea: make the free time visible fast, make it survive real calendars, and make
        finding it feel good on a phone.
      </p>
      <div className="mx-auto mt-8 max-w-xs">
        <PillButton label="Start a poll" onPress={onBackToStart} />
      </div>
    </div>
  </footer>
)
