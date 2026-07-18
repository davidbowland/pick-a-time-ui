import React, { useEffect, useId, useRef } from 'react'

import { TimeRangePreset, TIME_RANGE_PRESETS, matchingPresetLabel } from './helpers'
import { useTimeEditorCoordinator } from './time-editor-coordinator'
import { TimeRangeEditor } from './time-range-editor'
import { Chip } from '@components/ui/chip'
import { formatMinuteOfDay } from '@utils/time'

export const TimesToggle = ({
  usesTimes,
  onChange,
}: {
  usesTimes: boolean
  onChange: (usesTimes: boolean) => void
}): React.ReactNode => {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        Does the time of day matter?
      </span>
      <div aria-labelledby={labelId} className="flex gap-1.5" role="group">
        <Chip onPress={() => onChange(false)} selected={!usesTimes}>
          Dates only
        </Chip>
        <Chip onPress={() => onChange(true)} selected={usesTimes}>
          Dates & times
        </Chip>
      </div>
    </div>
  )
}

export const WeekendTimesToggle = ({
  weekendsDiffer,
  onChange,
}: {
  weekendsDiffer: boolean
  onChange: (weekendsDiffer: boolean) => void
}): React.ReactNode => {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        Same hours every day?
      </span>
      <div aria-labelledby={labelId} className="flex gap-1.5" role="group">
        <Chip onPress={() => onChange(false)} selected={!weekendsDiffer}>
          Same time
        </Chip>
        <Chip onPress={() => onChange(true)} selected={weekendsDiffer}>
          Weekends differ
        </Chip>
      </div>
    </div>
  )
}

export const TimeRangeField = ({
  startMinute,
  endMinute,
  step,
  onChangeStart,
  onChangeEnd,
  error,
  label = 'Time window',
}: {
  startMinute: number
  endMinute: number
  step: number
  onChangeStart: (minute: number) => void
  onChangeEnd: (minute: number) => void
  error?: string
  label?: string
}): React.ReactNode => {
  const labelId = useId()
  const fieldKey = useId()
  const { activeKey, setActiveKey } = useTimeEditorCoordinator()
  const editingField: 'start' | 'end' | null =
    activeKey === `${fieldKey}-start` ? 'start' : activeKey === `${fieldKey}-end` ? 'end' : null
  const matchedPreset = matchingPresetLabel(startMinute, endMinute)
  const chipsDisabled = activeKey !== null

  const triggerRef = useRef<HTMLElement | null>(null)

  const openEditor = (field: 'start' | 'end'): void => {
    triggerRef.current = document.activeElement as HTMLElement | null
    setActiveKey(`${fieldKey}-${field}`)
  }
  const closeEditor = (): void => setActiveKey(null)

  // Restore focus to the trigger only after the re-render that re-enables it has
  // committed to the DOM — calling .focus() synchronously in closeEditor would target
  // a still-disabled button (setActiveKey is batched) and silently fail.
  useEffect(() => {
    if (editingField === null && triggerRef.current) {
      triggerRef.current.focus()
      triggerRef.current = null
    }
  }, [editingField])

  const applyPreset = (preset: TimeRangePreset): void => {
    onChangeStart(preset.startMinute)
    onChangeEnd(preset.endMinute)
  }

  return (
    <div className="relative flex flex-col gap-3">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        {label}
      </span>
      <div aria-labelledby={labelId} className="flex flex-wrap gap-1.5" role="group">
        {TIME_RANGE_PRESETS.map((preset) => (
          <Chip
            disabled={chipsDisabled}
            key={preset.label}
            onPress={() => applyPreset(preset)}
            selected={matchedPreset === preset.label}
          >
            {preset.label}
          </Chip>
        ))}
        <Chip disabled={chipsDisabled} onPress={() => openEditor('start')} selected={matchedPreset === undefined}>
          Custom
        </Chip>
      </div>
      <div className="flex items-center gap-2 text-sm text-[var(--bone)]">
        <Chip
          aria-label={`Start time, ${label}, ${formatMinuteOfDay(startMinute)}`}
          disabled={chipsDisabled}
          onPress={() => openEditor('start')}
        >
          {formatMinuteOfDay(startMinute)}
        </Chip>
        <span className="text-xs text-[var(--slate)]">to</span>
        <Chip
          aria-label={`End time, ${label}, ${formatMinuteOfDay(endMinute)}`}
          disabled={chipsDisabled}
          onPress={() => openEditor('end')}
        >
          {formatMinuteOfDay(endMinute)}
        </Chip>
      </div>
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
      {editingField && (
        <TimeRangeEditor
          fieldLabel={editingField === 'start' ? `Start time, ${label}` : `End time, ${label}`}
          key={editingField}
          minute={editingField === 'start' ? startMinute : endMinute}
          onCancel={closeEditor}
          onCommit={(minute) => {
            ;(editingField === 'start' ? onChangeStart : onChangeEnd)(minute)
          }}
          step={step}
        />
      )}
    </div>
  )
}

export function formatSlotMinutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`
  const hours = minutes / 60
  return `${hours % 1 === 0 ? hours : hours.toFixed(1)} hr`
}

export const SlotDurationPicker = ({
  allowedSlotMinutes,
  value,
  onChange,
}: {
  allowedSlotMinutes: number[]
  value: number
  onChange: (slotMinutes: number) => void
}): React.ReactNode => {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        Meeting length
      </span>
      <div aria-labelledby={labelId} className="flex flex-wrap gap-1.5" role="group">
        {allowedSlotMinutes.map((minutes) => (
          <Chip key={minutes} onPress={() => onChange(minutes)} selected={value === minutes}>
            {formatSlotMinutesLabel(minutes)}
          </Chip>
        ))}
      </div>
    </div>
  )
}
