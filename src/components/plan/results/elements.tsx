import { AlertDescription, AlertRoot, Button, Spinner, Tab, TabIndicator, TabList, TabPanel, Tabs } from '@heroui/react'
import React from 'react'

export const ModeTabs = ({
  mode,
  onChange,
  children,
}: {
  mode: 'pattern' | 'week'
  onChange: (mode: 'pattern' | 'week') => void
  children: React.ReactNode
}): React.ReactNode => (
  <Tabs aria-label="Overlap view" onSelectionChange={(key) => onChange(key as 'pattern' | 'week')} selectedKey={mode}>
    <TabList>
      {/* TabIndicator renders the visible "pill" behind the selected tab. Each Tab supplies its
          own selection state to its own TabIndicator via context, so it must live inside the
          Tab it belongs to — without it the only sign of which tab is selected is a subtle text
          color change, which isn't a strong enough non-color-alone cue. */}
      <Tab id="pattern">
        Pattern
        <TabIndicator />
      </Tab>
      <Tab id="week">
        By week
        <TabIndicator />
      </Tab>
    </TabList>
    {/* Both panels render the same content — whichever isn't currently selected never mounts
        (react-aria's TabPanel returns null unless selected). This keeps the visible results
        content inside the tabpanel landmark associated with the active tab, instead of floating
        outside the tab structure where a screen reader user switching tabs would hear nothing. */}
    <TabPanel id="pattern">{children}</TabPanel>
    <TabPanel id="week">{children}</TabPanel>
  </Tabs>
)

export const BestSlotBanner = ({
  label,
  freeCount,
  total,
}: {
  label: string
  freeCount: number
  total: number
}): React.ReactNode => (
  <div className="flex items-center justify-between rounded-2xl bg-black/80 p-4 text-white">
    <div>
      <div className="text-xs uppercase tracking-wide opacity-60">Best time</div>
      <div className="text-sm font-semibold">{label}</div>
    </div>
    <div className="text-xs opacity-60">
      {freeCount} of {total} free
    </div>
  </div>
)

export const EmptyBestSlot = (): React.ReactNode => (
  <div className="rounded-2xl bg-black/80 p-4 text-center text-sm text-white/80">
    No overlap yet. Once everyone paints their availability, the best time will show up here.
  </div>
)

export const LoadingState = (): React.ReactNode => (
  <div className="flex items-center gap-3 p-4 text-sm text-[#9CA3AF]" role="status">
    <Spinner size="sm" />
    <span>Loading everyone&rsquo;s availability&hellip;</span>
  </div>
)

export const ErrorState = ({ onRetry }: { onRetry: () => void }): React.ReactNode => (
  <div className="flex flex-col items-center gap-3 p-4 text-center" role="alert">
    <AlertRoot status="danger">
      <AlertDescription>Couldn&rsquo;t load the results. Check your connection and try again.</AlertDescription>
    </AlertRoot>
    <Button onPress={onRetry} variant="secondary">
      Try again
    </Button>
  </div>
)

export const WeekNav = ({
  week,
  weekCount,
  onChange,
}: {
  week: number
  weekCount: number
  onChange: (week: number) => void
}): React.ReactNode => (
  <div className="flex items-center justify-between text-xs text-[#D4D4D4]">
    <button
      aria-label="Previous week"
      className="rounded-full border border-white/[0.09] bg-white/[0.05] px-3 py-1 disabled:opacity-30"
      disabled={week === 0}
      onClick={() => onChange(week - 1)}
      type="button"
    >
      Prev
    </button>
    <span>
      Week {week + 1} of {weekCount}
    </span>
    <button
      aria-label="Next week"
      className="rounded-full border border-white/[0.09] bg-white/[0.05] px-3 py-1 disabled:opacity-30"
      disabled={week === weekCount - 1}
      onClick={() => onChange(week + 1)}
      type="button"
    >
      Next
    </button>
  </div>
)

export const ExceptionsList = ({ exceptions }: { exceptions: string[] }): React.ReactNode =>
  exceptions.length === 0 ? null : (
    <div className="flex flex-col gap-1">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Heads up</div>
      <ul className="flex flex-col gap-1 text-xs text-[#6B7280]">
        {exceptions.map((text, index) => (
          // Index, not the description text, is the key: two exceptions can share identical
          // wording (e.g. the same "is out" message for different weeks), which would collide
          // if the text itself were used as the key.
          <li key={index}>{text}</li>
        ))}
      </ul>
    </div>
  )
