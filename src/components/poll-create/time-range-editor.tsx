import React, { useEffect, useState } from 'react'

import { TimeWheelColumn, TimeWheelOption } from './time-wheel-column'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { useCoarsePointer } from '@hooks/useCoarsePointer'
import { ClockPeriod, fromClockParts, toClockParts } from '@utils/time'

const HOUR_OPTIONS: TimeWheelOption[] = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}))
const PERIOD_OPTIONS: TimeWheelOption[] = [
  { value: 'AM', label: 'AM' },
  { value: 'PM', label: 'PM' },
]

function minuteOptionsForStep(step: number): TimeWheelOption[] {
  const count = Math.max(1, Math.floor(60 / step))
  return Array.from({ length: count }, (_, i) => {
    const label = String(i * step).padStart(2, '0')
    return { value: label, label }
  })
}

const SELECT_CLASS = `rounded-md border border-[var(--hair)] bg-[var(--ink)] px-1 py-1 text-sm text-[var(--bone)] ${FOCUS_RING}`

export const TimeRangeEditor = ({
  fieldLabel,
  minute,
  step,
  onCommit,
  onCancel,
}: {
  fieldLabel: string
  minute: number
  step: number
  onCommit: (minute: number) => void
  onCancel: () => void
}): React.ReactNode => {
  const isCoarsePointer = useCoarsePointer()
  const initialParts = toClockParts(minute)
  const [hour, setHour] = useState(String(initialParts.hour12))
  const [minuteOfHour, setMinuteOfHour] = useState(String(initialParts.minute).padStart(2, '0'))
  const [period, setPeriod] = useState<ClockPeriod>(initialParts.period)
  const minuteOptions = minuteOptionsForStep(step)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])

  const commitParts = (nextHour: string, nextMinute: string, nextPeriod: ClockPeriod): void => {
    setHour(nextHour)
    setMinuteOfHour(nextMinute)
    setPeriod(nextPeriod)
    onCommit(fromClockParts(Number(nextHour), Number(nextMinute), nextPeriod))
  }

  return (
    <>
      <div className="fixed inset-0 z-10" onClick={onCancel} />
      <div
        aria-label={fieldLabel}
        className={
          isCoarsePointer
            ? 'fixed inset-x-0 bottom-0 z-20 rounded-t-2xl border-t border-[var(--hair)] bg-[var(--surface)] p-4 shadow-[0_-6px_24px_rgba(0,0,0,0.5)]'
            : 'absolute z-20 mt-2 w-60 rounded-xl border border-[var(--hair)] bg-[var(--surface)] p-4 shadow-[0_8px_28px_rgba(0,0,0,0.5)]'
        }
        role="group"
      >
        <p className="mb-3 text-xs font-bold text-[var(--bone)]">{fieldLabel}</p>
        {isCoarsePointer ? (
          <div className="flex justify-center gap-2">
            <TimeWheelColumn aria-label="Hour" autoFocus onChange={setHour} options={HOUR_OPTIONS} value={hour} />
            <TimeWheelColumn
              aria-label="Minute"
              onChange={setMinuteOfHour}
              options={minuteOptions}
              value={minuteOfHour}
            />
            <TimeWheelColumn
              aria-label="AM or PM"
              onChange={(v) => setPeriod(v as ClockPeriod)}
              options={PERIOD_OPTIONS}
              value={period}
            />
          </div>
        ) : (
          <div className="flex gap-1.5">
            <select
              aria-label="Hour"
              autoFocus
              className={SELECT_CLASS}
              onChange={(event) => commitParts(event.target.value, minuteOfHour, period)}
              value={hour}
            >
              {HOUR_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Minute"
              className={SELECT_CLASS}
              onChange={(event) => commitParts(hour, event.target.value, period)}
              value={minuteOfHour}
            >
              {minuteOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="AM or PM"
              className={SELECT_CLASS}
              onChange={(event) => commitParts(hour, minuteOfHour, event.target.value as ClockPeriod)}
              value={period}
            >
              {PERIOD_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {isCoarsePointer && (
          <div className="mt-4 flex justify-end gap-3 text-xs font-bold">
            <button className={`text-[var(--slate)] ${FOCUS_RING}`} onClick={onCancel} type="button">
              Cancel
            </button>
            <button
              className={`rounded-lg bg-[var(--accent)] px-3 py-1.5 text-[var(--ink)] ${FOCUS_RING}`}
              onClick={() => {
                onCommit(fromClockParts(Number(hour), Number(minuteOfHour), period))
                onCancel()
              }}
              type="button"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </>
  )
}
