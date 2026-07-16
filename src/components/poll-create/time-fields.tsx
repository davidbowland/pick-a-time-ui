import { Slider } from '@heroui/react'
import React, { useId } from 'react'

import { Chip } from '@components/ui/chip'
import { FOCUS_RING } from '@components/ui/focus-ring'
import { formatMinuteOfDay } from '@utils/time'

const SLIDER_THUMB_CLASS = `h-5 w-5 rounded-full border-2 border-[var(--ink)] bg-[var(--accent)] shadow-[0_2px_6px_rgba(0,0,0,0.35)] data-[dragging]:scale-110 transition-transform duration-150 ease-out ${FOCUS_RING}`

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

export const TimeRangeSlider = ({
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
  return (
    <div className="flex flex-col gap-3">
      <span className="text-sm font-medium text-[var(--slate)]" id={labelId}>
        {label}
      </span>
      <Slider
        aria-labelledby={labelId}
        className="px-1"
        maxValue={1440}
        minValue={0}
        onChange={(value) => {
          const [start, end] = value as number[]
          onChangeStart(start)
          onChangeEnd(end)
        }}
        step={step}
        value={[startMinute, endMinute]}
      >
        <Slider.Track className="relative h-1.5 rounded-full bg-[var(--bone)]/[0.12]">
          <Slider.Fill className="absolute h-full rounded-full bg-[var(--accent)]" />
          {/* react-aria's Slider only formats its aria-valuetext via Intl.NumberFormatOptions,
              which can't render "9:00 AM" from a raw minute-of-day integer — an explicit
              aria-valuetext is the correct ARIA attribute for a non-numeric value description
              and takes priority over whatever the library would otherwise compute, the same way
              the aria-label below already overrides the library's own generated label. Without
              it, a screen-reader/keyboard user dragging these thumbs hears the bare integer
              ("540") instead of the clock time sighted users see below the track. */}
          <Slider.Thumb
            aria-label={`From (time), ${label}`}
            aria-valuetext={formatMinuteOfDay(startMinute)}
            className={SLIDER_THUMB_CLASS}
            index={0}
          />
          <Slider.Thumb
            aria-label={`To (time), ${label}`}
            aria-valuetext={formatMinuteOfDay(endMinute)}
            className={SLIDER_THUMB_CLASS}
            index={1}
          />
        </Slider.Track>
      </Slider>
      <div className="flex justify-between text-xs text-[var(--slate)]">
        <span>{formatMinuteOfDay(startMinute)}</span>
        <span>{formatMinuteOfDay(endMinute)}</span>
      </div>
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
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
