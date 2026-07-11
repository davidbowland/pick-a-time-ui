import { Checkbox, CheckboxGroup, FieldError, Input, Label, TextField } from '@heroui/react'
import React, { useId } from 'react'

export const CreateCard = ({ children }: { children: React.ReactNode }): React.ReactNode => (
  <div className="arena-glass-outer">
    <div className="arena-glass-inner p-6">
      <div className="flex flex-col gap-[18px]">{children}</div>
    </div>
  </div>
)

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const PlanNameField = ({
  value,
  error,
  onChange,
}: {
  value: string
  error?: string
  onChange: (value: string) => void
}): React.ReactNode => (
  <TextField isInvalid={!!error}>
    <Label>Plan name</Label>
    <Input onChange={(e) => onChange(e.target.value)} placeholder="Fall rec soccer practice" value={value} />
    {error && <FieldError>{error}</FieldError>}
  </TextField>
)

export const WeekdayPicker = ({
  selected,
  onChange,
}: {
  selected: number[]
  onChange: (weekdays: number[]) => void
}): React.ReactNode => {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[#D4D4D4]" id={labelId}>
        Which days?
      </span>
      <CheckboxGroup
        aria-labelledby={labelId}
        className="flex-row flex-wrap gap-3 [&_[data-slot=checkbox]]:mt-0"
        onChange={(values) => onChange(values.map(Number).sort((a, b) => a - b))}
        value={selected.map(String)}
      >
        {WEEKDAY_LABELS.map((label, day) => (
          <Checkbox key={day} value={String(day)}>
            <Checkbox.Content>
              <Checkbox.Control>
                <Checkbox.Indicator />
              </Checkbox.Control>
              {label}
            </Checkbox.Content>
          </Checkbox>
        ))}
      </CheckboxGroup>
    </div>
  )
}

export const WeekCountStepper = ({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}): React.ReactNode => {
  const labelId = useId()
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-[#D4D4D4]" id={labelId}>
        How many weeks?
      </span>
      <div aria-labelledby={labelId} className="flex items-center gap-4" role="group">
        <button aria-label="Fewer weeks" onClick={() => onChange(Math.max(1, value - 1))} type="button">
          −
        </button>
        <span aria-live="polite">
          {value} week{value === 1 ? '' : 's'}
        </span>
        <button aria-label="More weeks" onClick={() => onChange(Math.min(12, value + 1))} type="button">
          +
        </button>
      </div>
    </div>
  )
}

function formatHour(hour: number): string {
  const normalized = ((hour % 24) + 24) % 24
  const period = normalized < 12 ? 'AM' : 'PM'
  const displayHour = normalized % 12 === 0 ? 12 : normalized % 12
  return `${displayHour}:00 ${period}`
}

export const HourRangeFields = ({
  startHour,
  endHour,
  onChangeStart,
  onChangeEnd,
  error,
}: {
  startHour: number
  endHour: number
  onChangeStart: (hour: number) => void
  onChangeEnd: (hour: number) => void
  error?: string
}): React.ReactNode => {
  const startId = useId()
  const endId = useId()
  const startHintId = useId()
  const endHintId = useId()

  const handleChange = (raw: string, onChange: (hour: number) => void): void => {
    // Ignore empty/unparseable input rather than silently coercing to 0 — the
    // controlled value snaps back to the last valid hour instead.
    if (raw === '') return
    const parsed = Number(raw)
    if (Number.isNaN(parsed)) return
    onChange(parsed)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={startId}>From (hour)</label>
          <input
            aria-describedby={startHintId}
            id={startId}
            max={23}
            min={0}
            onChange={(e) => handleChange(e.target.value, onChangeStart)}
            type="number"
            value={startHour}
          />
          <span aria-live="polite" className="text-xs text-[#A3A3A3]" id={startHintId}>
            {formatHour(startHour)}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={endId}>To (hour)</label>
          <input
            aria-describedby={endHintId}
            id={endId}
            max={24}
            min={1}
            onChange={(e) => handleChange(e.target.value, onChangeEnd)}
            type="number"
            value={endHour}
          />
          <span aria-live="polite" className="text-xs text-[#A3A3A3]" id={endHintId}>
            {formatHour(endHour)}
          </span>
        </div>
      </div>
      {error && (
        <span className="text-xs text-red-400" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}
