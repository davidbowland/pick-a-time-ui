import React, { useId } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

export type ScenarioPreset = (
  | { label: string; weekdays: number[]; usesTimes: true; startMinute: number; endMinute: number; slotMinutes: number }
  | { label: string; weekdays: number[]; usesTimes: false }
) & { short: string; group: 'weekday' | 'weekend' }

export const SCENARIO_PRESETS: ScenarioPreset[] = [
  {
    label: 'Weekday lunch',
    short: 'Lunch',
    group: 'weekday',
    weekdays: [1, 2, 3, 4, 5],
    usesTimes: true,
    startMinute: 690,
    endMinute: 810,
    slotMinutes: 60,
  },
  {
    label: 'Weekday evening',
    short: 'Evening',
    group: 'weekday',
    weekdays: [1, 2, 3, 4, 5],
    usesTimes: true,
    startMinute: 1050,
    endMinute: 1200,
    slotMinutes: 90,
  },
  { label: 'Weekdays, no time', short: 'No time', group: 'weekday', weekdays: [1, 2, 3, 4, 5], usesTimes: false },
  {
    label: 'Weekend brunch',
    short: 'Brunch',
    group: 'weekend',
    weekdays: [0, 6],
    usesTimes: true,
    startMinute: 600,
    endMinute: 780,
    slotMinutes: 90,
  },
  {
    label: 'Weekend dinner',
    short: 'Dinner',
    group: 'weekend',
    weekdays: [5, 6],
    usesTimes: true,
    startMinute: 1080,
    endMinute: 1260,
    slotMinutes: 90,
  },
  { label: 'Weekends, no time', short: 'No time', group: 'weekend', weekdays: [0, 6], usesTimes: false },
]

const GROUPS: { label: string; group: ScenarioPreset['group'] }[] = [
  { label: 'Weekdays', group: 'weekday' },
  { label: 'Weekends', group: 'weekend' },
]

const SHORTCUT_CLASS = `inline-flex items-center gap-1 rounded-full border border-dashed border-[var(--hair)] px-3 py-1.5 text-xs font-bold text-[var(--slate)] transition-colors duration-150 ease-out hover:border-[var(--accent)] hover:text-[var(--accent)] ${FOCUS_RING}`

export const ScenarioPresets = ({ onApply }: { onApply: (preset: ScenarioPreset) => void }): React.ReactNode => {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        Quick-fill (optional)
      </span>
      <p className="text-xs text-[var(--slate)]">Tap to fill in the days, dates, and time below.</p>
      <div aria-labelledby={labelId} className="flex flex-col gap-2">
        {GROUPS.map((g) => (
          <div className="flex flex-col gap-1.5" key={g.group}>
            <span className="text-xs font-bold tracking-wide text-[var(--slate)] uppercase">{g.label}</span>
            <div aria-label={g.label} className="flex flex-wrap gap-1.5" role="group">
              {SCENARIO_PRESETS.filter((preset) => preset.group === g.group).map((preset) => (
                <button
                  aria-label={`${g.label} ${preset.short}`}
                  className={SHORTCUT_CLASS}
                  key={preset.label}
                  onClick={() => onApply(preset)}
                  type="button"
                >
                  <span aria-hidden="true">→</span>
                  {preset.short}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
