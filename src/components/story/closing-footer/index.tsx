import React from 'react'

import { PillButton } from '@components/ui/pill-button'

export const ClosingFooter = ({ onBackToStart }: { onBackToStart: () => void }): React.ReactNode => (
  <footer className="px-5 py-32 text-center">
    <div className="mx-auto max-w-[640px]">
      <h2 className="text-[clamp(1.6rem,3vw,2.2rem)] font-medium text-[var(--copy-color,var(--bone))]">
        Now go find the time that works.
      </h2>
      <p className="mt-4 text-[1.02rem] leading-relaxed text-[var(--copy-color,var(--bone))]/75">
        One link, no accounts, no back-and-forth — and it&apos;s always free.
      </p>
      <div className="mx-auto mt-8 max-w-xs">
        <PillButton label="Start a poll" onPress={onBackToStart} />
      </div>
    </div>
  </footer>
)
