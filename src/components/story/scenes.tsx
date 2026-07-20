import { Check, Pencil, Star } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import React from 'react'

import { PhoneMock } from '@components/story/phone-mock'
import { EyebrowTag } from '@components/ui/eyebrow-tag'
import { pickAccessibleTextColor } from '@utils/contrast'

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

const ScreenHeader = ({ eyebrow, title }: { eyebrow: string; title?: string }): React.ReactNode => (
  <div className="flex flex-col items-center gap-1 px-1 pt-1 text-center">
    <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-[var(--slate)]">{eyebrow}</span>
    {title && (
      <span className="text-2xl text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
        {title}
      </span>
    )}
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

// A stand-in for the real product's `Chip` (src/components/ui/chip): that component's unselected
// skin is tuned for the app's dark surfaces (`text-[var(--bone)]` on a near-black background) and
// would render near-invisible against these mocks' deliberately light `bg-[var(--bone)]` phone
// screen. Same reasoning as `MockPrimaryPill`/`MockSecondaryPill` below already diverging from the
// real `PillButton` for the same light-screen reason.
const MockChip = ({ label }: { label: string }): React.ReactNode => (
  <span className="rounded-xl border border-black/10 px-3 py-1.5 text-xs font-bold text-[var(--ink)]">{label}</span>
)

// Mirrors `BestSlotBanner` (src/components/poll/results/elements.tsx) — same gold star badge,
// same "Best time" / attendance-tag shape — reused by both HeroScene and ResultsScene so the two
// mocks don't drift from each other.
const MockBestSlotBanner = ({
  label,
  attendance,
  freeCount,
  total,
}: {
  label: string
  attendance?: string
  freeCount: number
  total: number
}): React.ReactNode => (
  <div className="relative flex flex-col gap-3 rounded-2xl bg-[var(--ink)] p-4 text-[var(--bone)]">
    <span
      aria-hidden="true"
      className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--gold)]"
    >
      <Star className="h-3.5 w-3.5 text-[var(--ink)]" fill="currentColor" />
    </span>
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest opacity-60">Best time</p>
        <p className="mt-0.5 text-sm font-semibold">{label}</p>
      </div>
      <div className="text-right text-[10px] opacity-65">
        {attendance && <p className="text-[11px] font-semibold text-[var(--bone)] opacity-100">{attendance}</p>}
        <p className="whitespace-nowrap">
          {freeCount} of {total} free
        </p>
      </div>
    </div>
  </div>
)

// Loosely mirrors `SuggestedTimes`' list rows (src/components/poll/results/elements.tsx) — same
// label/attendance/count shape, re-tinted for this mock's light phone screen instead of the real
// component's dark-surface styling (same reasoning as `MockPollHeader`/`MockTabs` below).
const MockSuggestedTimeRow = ({
  label,
  attendance,
  freeCount,
  total,
}: {
  label: string
  attendance: string
  freeCount: number
  total: number
}): React.ReactNode => (
  <div className="flex items-baseline justify-between gap-2.5 rounded-2xl border border-black/[0.06] px-3 py-2.5 text-sm text-[var(--ink)]">
    <span>{label}</span>
    <span className="text-right text-[11px] whitespace-nowrap text-[var(--slate-on-light)]">
      {attendance}
      <br />
      {freeCount} of {total} free
    </span>
  </div>
)

// Loosely mirrors `poll/index.tsx`'s real title + expiration line, scaled for the mock.
const MockPollHeader = ({ title, expiry }: { title: string; expiry: string }): React.ReactNode => (
  <div>
    <p className="text-xl text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
      {title}
    </p>
    <p className="mt-0.5 text-[11px] text-[var(--slate-on-light)]">{expiry}</p>
  </div>
)

// Loosely mirrors `poll/index.tsx`'s real tab-pill row (`role="tablist"` styling), scaled for the
// mock and re-tinted for a light phone screen instead of the app's dark background.
const MockTabs = ({ active }: { active: 'painting' | 'results' }): React.ReactNode => {
  const tabClass = (isActive: boolean): string =>
    `rounded-full px-3.5 py-1.5 text-xs font-bold ${isActive ? 'bg-[var(--accent)] text-[var(--ink)]' : 'text-[var(--slate-on-light)]'}`
  return (
    <div className="inline-flex w-fit gap-1 rounded-full bg-black/5 p-1">
      <span className={tabClass(active === 'painting')}>Your hours</span>
      <span className={tabClass(active === 'results')}>The overlap</span>
    </div>
  )
}

// Loosely mirrors `VoterIdentityControl` (src/components/poll/voter-identity/index.tsx)'s "Voting
// as" row and its rename affordance — static illustrative markup, not a functional control.
const MockVotingAsRow = (): React.ReactNode => (
  <div className="flex flex-wrap items-center gap-x-1.5 text-xs text-[var(--slate-on-light)]">
    <span>
      Voting as <span className="font-semibold text-[var(--ink)]">Quiet Falcon</span>
    </span>
    {/* Mirrors `EditNameButton`'s pencil affordance (src/components/poll/voter-identity/elements.tsx),
      re-toned for this light phone-screen mock — static illustration, not a real control. */}
    <span
      aria-hidden="true"
      className="flex h-6 w-6 items-center justify-center rounded-full border border-black/15 text-[var(--slate-on-light)]"
    >
      <Pencil className="h-3 w-3" />
    </span>
  </div>
)

// Mirrors `UserOptions`' radio rows (src/components/poll/identity/elements.tsx), styled to look
// like a radio without being a real focusable `<input type="radio">`.
const MockRadioOption = ({ label, selected }: { label: string; selected?: boolean }): React.ReactNode => (
  <div
    className={`flex items-center gap-2.5 border-b border-black/10 py-3 text-sm text-[var(--ink)] last:border-b-0 ${selected ? 'font-bold' : ''}`}
  >
    <span
      className={`relative h-4 w-4 shrink-0 rounded-full border-2 ${selected ? 'border-[var(--accent)]' : 'border-black/15'}`}
    >
      {selected && <span className="absolute inset-[3px] rounded-full bg-[var(--accent)]" />}
    </span>
    {label}
  </div>
)

export const HeroScene = (): React.ReactNode => (
  <SceneLayout
    copy="Start a poll. Send one link. Watch the times fill in as people mark when they're free. No downloads, no logins needed."
    eyebrow="No cost. No account."
    heading="Find the minute everybody's free."
    visual={
      <PhoneMock>
        <div className="flex flex-col gap-3 px-5 pb-6">
          <MockPollHeader expiry="Poll closed · Fri, Sep 5" title="Game night" />
          <MockTabs active="results" />
          <p className="text-2xl text-[var(--ink)]" style={{ fontFamily: 'var(--font-display)' }}>
            Friday works for everybody.
          </p>
          <PhoneCard>
            <MockBestSlotBanner freeCount={5} label="Fri 6:00–7:00 PM" total={5} />
          </PhoneCard>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold tracking-wide text-[var(--slate-on-light)] uppercase">
              Other suggested times
            </p>
            <MockSuggestedTimeRow attendance="Best available" freeCount={4} label="Sat 9/6, 2:00–3:00 PM" total={5} />
          </div>
          <p className="text-center text-xs text-[var(--slate-on-light)]">18 dates checked</p>
        </div>
      </PhoneMock>
    }
  />
)

export const IdentityScene = (): React.ReactNode => (
  <SceneLayout
    copy="Type a name and it's yours. Leave it blank and we'll give you a fun one, visible only to this group. Change it anytime. Want your name to follow you across devices? Sign in with Google."
    eyebrow="Nothing for your guests to set up"
    heading="Join as you — or as Quiet Falcon."
    reverse
    visual={
      <PhoneMock>
        <div className="flex flex-col items-center gap-4 px-6 pb-6">
          <ScreenHeader eyebrow="Book club" />
          <div className="w-full text-left">
            <p className="text-lg font-semibold text-[var(--ink)]">Who are you on this poll?</p>
            <div className="mt-2 flex flex-col">
              <MockRadioOption label="Sam" />
              <MockRadioOption label="Jordan" />
              <MockRadioOption label="Join as somebody new" selected />
            </div>
          </div>
          <div className="w-full text-left">
            <p className="text-xs font-semibold text-[var(--slate-on-light)]">Your name</p>
            <div className="mt-1.5 rounded-xl border-2 border-[var(--slate-on-light)]/70 bg-black/[0.03] px-3.5 py-2.5 text-sm text-[var(--slate-on-light)]">
              e.g. Alex
            </div>
            <p className="mt-1.5 text-xs text-[var(--slate-on-light)]">
              Optional — skip it and we&rsquo;ll give you a name like &lsquo;Quiet Falcon.&rsquo;
            </p>
          </div>
          <div className="flex w-full flex-col items-center gap-3">
            <MockPrimaryPill label="Continue" />
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
// 3 dates x 3 times, strictly binary — mirrors `painting/grid.tsx`'s real
// `on ? 'bg-[var(--accent)]' : 'bg-[var(--bone)]/10'` logic 1:1, since this grid now sits on the
// same dark `--ink` panel the real app uses. Both Thu 11a and Fri 11a are `on` so the cursor dot
// sitting over their shared boundary reads as painting an already-marked cell, not empty space.
const PAINTING_GRID = [
  [false, false, true], // Thu
  [true, true, true], // Fri
  [true, true, false], // Sat
]

export const PaintingScene = (): React.ReactNode => (
  <SceneLayout
    copy="Tap the times that work. Nothing to type, nothing to explain. A one-off Saturday is just as easy to mark as a standing Tuesday night."
    eyebrow="No typing required"
    heading="Paint your hours."
    visual={
      <PhoneMock>
        <div className="flex flex-col gap-3 px-5 pb-6">
          <MockPollHeader expiry="Poll closes Sep 6" title="Coffee catch-up" />
          <MockTabs active="painting" />
          <MockVotingAsRow />
          <div className="flex gap-2">
            <MockChip label="Select all" />
            <MockChip label="Clear all" />
          </div>
          {/* Dark `--ink` panel: this is the app's real grid surface (PaintGrid renders its header
            and cells on `bg-[var(--ink)]`), inset here in the light phone screen so the mock reads
            as the actual product rather than a flat light grid. */}
          <div className="rounded-2xl bg-[var(--ink)] p-3.5">
            <div className="grid grid-cols-[auto_repeat(3,1fr)] items-center gap-1.5 text-[10px] text-[var(--slate)]">
              <span />
              {PAINTING_TIMES.map((time) => (
                <span className="text-center font-semibold text-[var(--bone)]" key={time}>
                  {time}
                </span>
              ))}
              {PAINTING_DATES.map((date, row) => (
                <React.Fragment key={date}>
                  <span className="pr-1 text-right">{date}</span>
                  {PAINTING_TIMES.map((time, col) => {
                    const on = PAINTING_GRID[row][col]
                    // The drag-paint cursor rides the Thu/Fri boundary in the 11a column (row 0's
                    // last cell). It's an absolutely-positioned overlay *inside* that cell, never a
                    // grid child: a grid child carrying an explicit span/placement is positioned
                    // before auto-flow runs, which then routes every real cell around the tracks it
                    // occupies and slides each row one column right — that was the diagonal cascade.
                    const showCursor = row === 0 && col === PAINTING_TIMES.length - 1
                    return (
                      <div
                        className={`relative flex h-6 items-center justify-center rounded-md ${
                          on ? 'bg-[var(--accent)]' : 'bg-[var(--bone)]/10'
                        }`}
                        key={time + row}
                      >
                        {on && <Check aria-hidden="true" className="h-4 w-4 text-[var(--ink)]/70" />}
                        {showCursor && (
                          // `#0f0f13` is intentionally a touch darker than `--ink` so the dot reads
                          // as its own object against the panel; the accent-soft ring is its glow.
                          <span
                            aria-hidden="true"
                            className="pointer-events-none absolute top-[calc(100%+3px)] left-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#0f0f13] shadow-[0_0_0_3px_rgba(126,205,179,0.55),0_4px_10px_rgba(0,0,0,0.5)]"
                          />
                        )}
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>
      </PhoneMock>
    }
  />
)

// Darkest (heat-0) -> brightest (heat-4), matching the live heat grid's "more free = brighter"
// scale (src/components/poll/results/heat-grid.tsx). The Fri 6p cell is the brightest step, to
// visually back up the "Best time: Fri 9/5, 6:00-7:00 PM" banner above it.
const HEAT_STEPS = ['heat-1', 'heat-2', 'heat-3', 'heat-2', 'heat-3', 'heat-4', 'heat-0', 'heat-2', 'heat-3']
const HEAT_LEGEND_STEPS = ['heat-0', 'heat-1', 'heat-2', 'heat-3', 'heat-4']
// The hex behind each `--heat-*` token (mirrors index.css) so the cell's free-count text color can
// be picked for AA contrast against it — exactly what the live grid does via pickAccessibleTextColor.
const HEAT_HEX: Record<string, string> = {
  'heat-0': '#287156',
  'heat-1': '#38a07a',
  'heat-2': '#55c39b',
  'heat-3': '#84d4b7',
  'heat-4': '#b4e4d3',
}
// The free-count each step stands in for on this 5-person poll. The live grid interpolates a
// distinct shade per count; the mock uses discrete steps, so these are representative counts —
// monotonic with brightness, brightest = all 5 free (matching the "5 of 5" best-slot banner).
const HEAT_FREE_COUNT: Record<string, number> = {
  'heat-0': 0,
  'heat-1': 1,
  'heat-2': 3,
  'heat-3': 4,
  'heat-4': 5,
}
const BEST_SLOT_INDEX = HEAT_STEPS.indexOf('heat-4')
const HEAT_TIMES = ['4p', '5p', '6p']
const HEAT_DATES = ['Thu 9/4', 'Fri 9/5', 'Sat 9/6']

export const ResultsScene = (): React.ReactNode => (
  <SceneLayout
    copy="Every square gets brighter as more people say they're free. Scan every date at once. The brightest square is your best time. Even if no time works for everybody, you can see who's closest."
    eyebrow="No tallying required"
    heading="See the best time at a glance."
    reverse
    visual={
      <PhoneMock>
        <div className="flex flex-col gap-3 px-5 pb-6">
          <MockPollHeader expiry="Poll closes Sep 6" title="Band practice" />
          <MockTabs active="results" />
          <MockVotingAsRow />
          <MockBestSlotBanner attendance="Everybody's free" freeCount={5} label="Fri 9/5, 6:00–7:00 PM" total={5} />
          {/* Same dark `--ink` panel as PaintingScene — the app's real overlap surface. Grid and
            legend share the one panel so the two scenes read as two states of the same tool. */}
          <div className="flex flex-col gap-2.5 rounded-2xl bg-[var(--ink)] p-3.5">
            <div className="grid grid-cols-[auto_repeat(3,1fr)] items-center gap-1.5 text-[10px] text-[var(--slate)]">
              <span />
              {HEAT_TIMES.map((time) => (
                <span className="text-center font-semibold text-[var(--bone)]" key={time}>
                  {time}
                </span>
              ))}
              {HEAT_DATES.map((date, row) => (
                <React.Fragment key={date}>
                  <span className="pr-1 text-right">{date}</span>
                  {HEAT_TIMES.map((time, col) => {
                    const index = row * 3 + col
                    const step = HEAT_STEPS[index]
                    return (
                      <div
                        className="relative flex h-6 items-center justify-center rounded-md text-[10px] font-bold"
                        key={time}
                        style={{ background: `var(--${step})`, color: pickAccessibleTextColor(HEAT_HEX[step]) }}
                      >
                        {HEAT_FREE_COUNT[step]}
                        {index === BEST_SLOT_INDEX && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-[7px] -right-[7px] z-20 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--gold)]"
                          >
                            <Star className="h-2 w-2 text-[var(--ink)]" fill="currentColor" />
                          </span>
                        )}
                      </div>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[var(--slate)]">
              <span className="whitespace-nowrap">0 free</span>
              {HEAT_LEGEND_STEPS.map((step) => (
                <span className="h-3 w-3 rounded" key={step} style={{ background: `var(--${step})` }} />
              ))}
              <span className="whitespace-nowrap">all free</span>
            </div>
          </div>
          <p className="text-xs text-[var(--slate-on-light)]">Tap a square to see who&rsquo;s free.</p>
        </div>
      </PhoneMock>
    }
  />
)

export const ShareScene = (): React.ReactNode => (
  <SceneLayout
    copy="The poll lives at one address the whole time. Send it once — people join, mark the dates that work, and the overlap updates for everybody watching."
    eyebrow="One link, always current"
    heading="One link. Everybody finds their way back."
    visual={
      <PhoneMock>
        <div className="flex flex-col items-center gap-4 px-6 pb-6 text-center">
          <ScreenHeader eyebrow="Family reunion" title="Share this poll" />
          <div className="flex w-full items-center justify-between gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-left text-xs text-[var(--accent-text)]">
            <span className="truncate">pick-a-time.com/p/amber-harbor</span>
            <span className="rounded-full bg-black/5 px-3 py-1 text-[10px] font-bold text-[var(--ink)]">Copy</span>
          </div>
          {/* Light-on-ink so the code blends into its tile; the p-3 frame doubles as the quiet zone. */}
          <div className="rounded-2xl bg-[var(--ink)] p-3">
            <QRCodeSVG
              bgColor="#17171a"
              fgColor="#f2f1ee"
              size={112}
              title="QR code for pick-a-time.com"
              value="https://pick-a-time.com/"
            />
          </div>
          <p className="text-xs text-[var(--slate)]">
            <span className="whitespace-nowrap">5 joined</span> · <span className="whitespace-nowrap">18 dates</span> on
            the calendar
          </p>
          <Avatars />
        </div>
      </PhoneMock>
    }
  />
)
