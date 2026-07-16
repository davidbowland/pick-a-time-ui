import React from 'react'

import PollCreate from '@components/poll-create'
import { EyebrowTag } from '@components/ui/eyebrow-tag'

export const CreateScene = (): React.ReactNode => (
  // `grid-cols-1` (rather than bare `grid`) gives the mobile track an explicit `minmax(0, 1fr)`,
  // so it can't grow past the viewport to fit a descendant's un-wrapped `truncate` text
  // (`white-space: nowrap` reports that text's full width as this column's intrinsic size unless
  // something up the chain caps it) — that's what let the completed "Days & times" step's summary
  // blow the whole page out once it first rendered.
  <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-12 px-5 md:grid-cols-2 md:items-center md:gap-20">
    <div>
      <EyebrowTag>This one&apos;s live — try it now</EyebrowTag>
      <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-medium text-[var(--copy-color,var(--bone))]">
        Pick your dates.
      </h2>
      <p className="mt-4 max-w-[46ch] text-[1.08rem] leading-relaxed text-[var(--copy-color,var(--bone))]/75">
        Name the poll, pick the dates on the calendar — or fill in a weekly pattern in one tap — and add a time window
        if it matters. This form is real — fill it in and we&apos;ll build your poll.
      </p>
    </div>
    <div className="mx-auto w-full max-w-md">
      <PollCreate />
    </div>
  </div>
)
