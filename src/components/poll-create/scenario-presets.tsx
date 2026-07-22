import React, { useEffect, useId, useRef, useState } from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'
import { formatSlotRange } from '@utils/time'

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
    label: 'Weekday dinner',
    short: 'Dinner',
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

const SHORTCUT_BASE_CLASS = `inline-flex items-center gap-1 rounded-full border border-dashed px-3 py-1.5 text-xs font-bold transition-colors duration-150 ease-out ${FOCUS_RING}`
// Idle: muted, greens up on hover. Filled: the whole chip (border, arrow→check, label) goes accent
// green and stays green regardless of the pointer — so moving the mouse away doesn't strip the green
// from everything but the word "Filled." Reverts to idle when the flash timer clears.
const SHORTCUT_IDLE_CLASS =
  'border-[var(--hair)] text-[var(--slate)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
const SHORTCUT_FILLED_CLASS = 'border-[var(--accent)] text-[var(--accent)]'

// A preset is an action ("fill this in"), not a mode — so its feedback is momentary. It describes
// what was just filled for the polite live region; the chip itself flashes a transient "✓ Filled"
// and reverts, never claiming a persistent selected state that a later hand-edit would contradict.
export const describePreset = (preset: ScenarioPreset): string => {
  const days = preset.group === 'weekday' ? 'weekdays' : 'weekends'
  if (!preset.usesTimes) return `Filled ${days} · no set time`
  const window = formatSlotRange(preset.startMinute, preset.endMinute)
  return `Filled ${days} · ${preset.short.toLowerCase()} ${window} · ${preset.slotMinutes}-minute slots`
}

export const ScenarioPresets = ({
  onApply,
  schedule = setTimeout,
  clearTimeoutFn = clearTimeout,
  clearDelayMs = 1600,
}: {
  onApply: (preset: ScenarioPreset) => void
  schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>
  clearTimeoutFn?: (id: ReturnType<typeof setTimeout>) => void
  clearDelayMs?: number
}): React.ReactNode => {
  const labelId = useId()
  const [filledLabel, setFilledLabel] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleApply = (preset: ScenarioPreset): void => {
    onApply(preset)
    setAnnouncement(describePreset(preset))
    setFilledLabel(preset.label)
    if (timerRef.current) clearTimeoutFn(timerRef.current)
    timerRef.current = schedule(() => setFilledLabel(null), clearDelayMs)
  }

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeoutFn(timerRef.current)
    },
    [clearTimeoutFn],
  )

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
              {SCENARIO_PRESETS.filter((preset) => preset.group === g.group).map((preset) => {
                const isFilled = preset.label === filledLabel
                return (
                  <button
                    aria-label={`${g.label} ${preset.short}`}
                    className={`${SHORTCUT_BASE_CLASS} ${isFilled ? SHORTCUT_FILLED_CLASS : SHORTCUT_IDLE_CLASS}`}
                    key={preset.label}
                    onClick={() => handleApply(preset)}
                    type="button"
                  >
                    <span aria-hidden="true">{isFilled ? '✓' : '→'}</span>
                    <span>{isFilled ? 'Filled' : preset.short}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <p aria-live="polite" className="sr-only" role="status">
        {announcement}
      </p>
    </div>
  )
}
