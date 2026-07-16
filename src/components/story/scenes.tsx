import React from 'react'

import { PhoneMock } from '@components/story/phone-mock'
import { Chip } from '@components/ui/chip'
import { EyebrowTag } from '@components/ui/eyebrow-tag'

const SceneLayout = ({
  eyebrow,
  heading,
  copy,
  visual,
  reverse = false,
}: {
  eyebrow: string
  heading: string
  copy: string
  visual: React.ReactNode
  reverse?: boolean
}): React.ReactNode => (
  // `grid-cols-1` (rather than bare `grid`) gives the mobile track an explicit `minmax(0, 1fr)`,
  // so it can't grow past the viewport to fit a descendant's un-wrapped `truncate` text
  // (`white-space: nowrap` reports that text's full width as this column's intrinsic size
  // unless something up the chain caps it) — that's what let the completed "Days & times" step's
  // summary blow the whole page out once it first rendered.
  <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-12 px-5 md:grid-cols-2 md:items-center md:gap-20">
    <div className={reverse ? 'md:order-last' : undefined}>
      <EyebrowTag>{eyebrow}</EyebrowTag>
      <h2 className="mt-4 text-[clamp(1.9rem,3.6vw,2.9rem)] font-medium text-[var(--copy-color,var(--bone))]">
        {heading}
      </h2>
      <p className="mt-4 max-w-[46ch] text-[1.08rem] leading-relaxed text-[var(--copy-color,var(--bone))]/75">{copy}</p>
    </div>
    <div className={reverse ? 'md:order-first' : undefined}>{visual}</div>
  </div>
)

const AVATAR_GRADIENTS = [
  'from-[var(--accent)] to-[var(--accent-soft)]',
  'from-[var(--accent-soft)] to-[var(--accent)]',
  'from-[var(--ink)] to-[var(--accent)]',
  'from-[var(--accent)] to-[var(--ink)]',
  'from-[var(--accent-soft)] to-[var(--ink)]',
]

const PARTICIPANTS = ['QF', 'AH', 'GO', 'BH', 'DW']

const Avatars = (): React.ReactNode => (
  <div className="flex -space-x-2">
    {PARTICIPANTS.map((initials, i) => (
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-gradient-to-br text-[10px] font-bold text-white ${AVATAR_GRADIENTS[i]}`}
        key={initials}
      >
        {initials}
      </span>
    ))}
  </div>
)

const PhoneCard = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="w-full rounded-[1.75rem] border border-black/5 bg-white p-5 text-left shadow-[0_18px_40px_-24px_rgba(21,21,30,0.4)]">
    {children}
  </div>
)

const ScreenHeader = ({ eyebrow, title }: { eyebrow: string; title: string }): React.ReactNode => (
  <div className="flex flex-col items-center gap-1 px-1 pt-1 text-center">
    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--slate)]">{eyebrow}</span>
    <span className="text-2xl text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
      {title}
    </span>
  </div>
)

const MockPrimaryPill = ({ label }: { label: string }): React.ReactNode => (
  <div className="flex w-full items-center justify-between rounded-full bg-[var(--accent)] py-3 pr-[7px] pl-5 text-[13px] font-bold text-[var(--ink)]">
    <span>{label}</span>
    <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-black/[0.18]">
      →
    </span>
  </div>
)

const MockSecondaryPill = ({ label }: { label: string }): React.ReactNode => (
  <div className="flex w-full items-center justify-center gap-2 rounded-full border border-black/10 bg-white py-3 text-[13px] font-bold text-[var(--ink)]">
    {label}
  </div>
)

export const HeroScene = (): React.ReactNode => (
  <SceneLayout
    copy="No accounts, no reply-all thread. Start a poll, send one link, and watch the free time appear where everyone's schedules overlap."
    eyebrow="How it works"
    heading="Find the minute everyone's actually free."
    visual={
      <PhoneMock>
        <div className="flex flex-col items-center gap-5 px-5 pb-6">
          <ScreenHeader eyebrow="Your polls" title="Pick a Time" />
          <PhoneCard>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--slate)]">Poll</p>
            <p className="mt-1 text-lg font-medium text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
              Lunch with friends
            </p>
            <div className="mt-3">
              <Avatars />
            </div>
            <p className="mt-3 text-xs text-[var(--slate)]">5 of 5 responded · 18 dates</p>
            <div className="mt-3">
              <span className="rounded-xl border border-[var(--accent)]/25 bg-[var(--accent)]/10 px-3 py-1.5 text-xs font-bold text-[var(--accent-text)]">
                Fri 6–7 PM works best
              </span>
            </div>
          </PhoneCard>
        </div>
      </PhoneMock>
    }
  />
)

export const IdentityScene = (): React.ReactNode => (
  <SceneLayout
    copy="Everyone gets a name like this the moment they land — no login, no profile photo required. Want your real name instead, or to sign in with Google? Both are one tap away."
    eyebrow="No login needed"
    heading="Show up as Quiet Falcon."
    reverse
    visual={
      <PhoneMock>
        <div className="flex flex-col items-center gap-4 px-6 pb-6 text-center">
          <ScreenHeader eyebrow="Lunch with friends" title="You've joined as" />
          <div className="h-20 w-20 rounded-full bg-gradient-to-br from-[var(--accent-soft)] to-[var(--ink)]" />
          <div className="flex flex-col items-center gap-1">
            <p className="text-lg font-medium text-[var(--ink)]">Quiet Falcon</p>
            <span className="text-xs font-medium text-[var(--accent-text)] underline underline-offset-2">rename</span>
          </div>
          <p className="max-w-[26ch] text-xs text-[var(--slate)]">
            Auto-assigned, and only ever seen by this group. Change it whenever you like.
          </p>
          <div className="flex w-full flex-col items-center gap-3">
            <MockPrimaryPill label="Continue as Quiet Falcon" />
            <div className="flex w-full items-center gap-3 text-[10px] uppercase tracking-widest text-[var(--slate)]">
              <span className="h-px flex-1 bg-black/10" />
              or
              <span className="h-px flex-1 bg-black/10" />
            </div>
            <MockSecondaryPill label="Continue with Google" />
          </div>
        </div>
      </PhoneMock>
    }
  />
)

const PAINTING_TIMES = ['9a', '10a', '11a']
const PAINTING_DATES = ['Thu 9/4', 'Fri 9/5', 'Sat 9/6']

export const PaintingScene = (): React.ReactNode => (
  <SceneLayout
    copy="Mark the dates and times that work for you — every square is its own choice, so a one-off Saturday is just as easy as a standing Tuesday night."
    eyebrow="Marking your availability"
    heading="Paint your hours."
    visual={
      <PhoneMock>
        <div className="flex flex-col gap-3 px-5 pb-6">
          <ScreenHeader eyebrow="Lunch with friends" title="Mark your hours" />
          <div className="flex gap-2">
            <Chip as="span">All day</Chip>
            <Chip as="span">Clear</Chip>
          </div>
          <div className="grid grid-cols-[auto_repeat(3,1fr)] items-center gap-1.5 text-[10px] text-[var(--slate)]">
            <span />
            {PAINTING_TIMES.map((time) => (
              <span className="text-center font-semibold text-[var(--ink)]" key={time}>
                {time}
              </span>
            ))}
            {PAINTING_DATES.map((date, row) => (
              <React.Fragment key={date}>
                <span className="pr-1 text-right">{date}</span>
                {PAINTING_TIMES.map((time) => (
                  <div className="h-6 rounded-md bg-[var(--accent)]/25" key={time + row} />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </PhoneMock>
    }
  />
)

// Darkest (heat-0) -> brightest (heat-4), matching the live heat grid's "more free = brighter"
// scale (src/components/poll/results/heat-grid.tsx). The Fri 6p cell (index 5, row*3+col for row
// 1 col 2) is the brightest step, to visually back up the "Best time: Fri 9/5, 6:00-7:00 PM"
// badge above it.
const HEAT_STEPS = ['heat-1', 'heat-2', 'heat-3', 'heat-2', 'heat-3', 'heat-4', 'heat-0', 'heat-2', 'heat-3']
const HEAT_TIMES = ['4p', '5p', '6p']
const HEAT_DATES = ['Thu 9/4', 'Fri 9/5', 'Sat 9/6']

export const ResultsScene = (): React.ReactNode => (
  <SceneLayout
    copy="Every square lightens with how many people are actually free, across every candidate date at once."
    eyebrow="Where the overlap shows up"
    heading="The overlap, drawn in daylight."
    reverse
    visual={
      <PhoneMock>
        <div className="flex flex-col gap-3 px-5 pb-6">
          <ScreenHeader eyebrow="Lunch with friends" title="The overlap" />
          <div className="rounded-2xl bg-[var(--ink)] p-4 text-[var(--bone)]">
            <p className="text-[10px] uppercase tracking-widest opacity-60">Best time</p>
            <p className="text-sm font-semibold">Fri 9/5, 6:00–7:00 PM</p>
          </div>
          <div className="grid grid-cols-[auto_repeat(3,1fr)] items-center gap-1.5 text-[10px] text-[var(--slate)]">
            <span />
            {HEAT_TIMES.map((time) => (
              <span className="text-center font-semibold text-[var(--ink)]" key={time}>
                {time}
              </span>
            ))}
            {HEAT_DATES.map((date, row) => (
              <React.Fragment key={date}>
                <span className="pr-1 text-right">{date}</span>
                {HEAT_TIMES.map((time, col) => (
                  <div
                    className="h-6 rounded-md"
                    key={time}
                    style={{ background: `var(--${HEAT_STEPS[row * 3 + col]})` }}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>
      </PhoneMock>
    }
  />
)

export const ShareScene = (): React.ReactNode => (
  <SceneLayout
    copy="The poll lives at one address the whole time. Send it once — people join, mark the dates that work, and the overlap updates for everyone watching."
    eyebrow="One link, always current"
    heading="One link. Everyone finds their way back."
    visual={
      <PhoneMock>
        <div className="flex flex-col items-center gap-4 px-6 pb-6 text-center">
          <ScreenHeader eyebrow="Lunch with friends" title="Share this poll" />
          <div className="flex w-full items-center justify-between gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-left text-xs text-[var(--accent-text)]">
            <span className="truncate">pick-a-time.com/p/amber-harbor</span>
            <span className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-bold text-[var(--ink)]">Copy</span>
          </div>
          <div className="rounded-2xl bg-[var(--ink)] p-3">
            <div
              className="h-28 w-28 rounded-lg"
              style={{
                backgroundImage: 'repeating-conic-gradient(#17171a 0% 25%, #f2f1ee 0% 50%)',
                backgroundSize: '14px 14px',
              }}
            />
          </div>
          <p className="text-xs text-[var(--slate)]">5 joined · 18 dates on the calendar</p>
          <Avatars />
        </div>
      </PhoneMock>
    }
  />
)
