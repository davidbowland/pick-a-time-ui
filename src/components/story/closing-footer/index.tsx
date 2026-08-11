import React from 'react'

import { SceneHeadingLevel } from '@components/story/scenes'
import { PillButton } from '@components/ui/pill-button'

export const ClosingFooter = ({
  // Same prop, same default, same reason as the five scenes in `scenes.tsx`: collapsed beneath a
  // surface that owns the page, this footer is a level deeper and a hardcoded `h2` would leave it
  // outranking the control it lives inside (AC-048).
  headingLevel: Heading = 'h2',
  onBackToStart,
}: {
  headingLevel?: SceneHeadingLevel
  onBackToStart: () => void
}): React.ReactNode => (
  <footer className="px-5 py-12 text-center">
    <div className="mx-auto max-w-[640px]">
      <Heading className="text-[clamp(1.6rem,3vw,2.2rem)] font-medium text-[var(--copy-color,var(--bone))]">
        Now go find the time that works.
      </Heading>
      <p className="mt-4 text-[1.02rem] leading-relaxed text-[var(--copy-color,var(--bone))]/75">
        One link, no accounts, no back-and-forth — and it&apos;s always free.
      </p>
      <div className="mx-auto mt-8 max-w-xs">
        <PillButton label="Start a poll" onPress={onBackToStart} />
      </div>
    </div>
  </footer>
)
