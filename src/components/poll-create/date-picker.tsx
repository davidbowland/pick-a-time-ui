import { Calendar } from '@heroui/react'
import { CalendarDate, DateValue, getLocalTimeZone, parseDate, today as calendarToday } from '@internationalized/date'
import React from 'react'

import { FOCUS_RING } from '@components/ui/focus-ring'

const NAV_BUTTON_CLASS = `flex size-7 items-center justify-center rounded-full text-[var(--bone)] hover:bg-[var(--bone)]/[0.08] ${FOCUS_RING}`

// `today` gets an outline, never a fill, so it can never be mistaken for `selected` (a solid
// fill). The two-attribute `data-[selected=true]:data-[today=true]:` rule has higher CSS
// specificity than either single-attribute rule, so selected's fill always wins when a date is
// both today and selected, regardless of utility-class generation order.
//
// `disabled` (react-aria's own out-of-range state — e.g. dates before `minValue`, tested by
// 'disables dates before today' above) and `unavailable` (this component's own
// `isDateUnavailable`, e.g. the at-cap state) are two different react-aria concepts that both
// mean "you can't pick this" — both get the identical muted treatment so neither reads as a
// normal, selectable date.
const CELL_CLASS = `relative flex aspect-square size-full items-center justify-center rounded-2xl text-sm font-medium text-[var(--bone)] outline-none data-[hovered=true]:bg-[var(--bone)]/[0.08] data-[today=true]:bg-transparent data-[today=true]:font-bold data-[today=true]:ring-1 data-[today=true]:ring-inset data-[today=true]:ring-[var(--accent)] data-[selected=true]:bg-[var(--accent)] data-[selected=true]:text-[var(--ink)] data-[selected=true]:data-[today=true]:bg-[var(--accent)] data-[outside-month=true]:text-[var(--slate)]/50 data-[unavailable=true]:text-[var(--slate)]/50 data-[unavailable=true]:cursor-not-allowed data-[disabled=true]:text-[var(--slate)]/50 data-[disabled=true]:cursor-not-allowed data-[disabled=true]:line-through ${FOCUS_RING}`

// Only surface the running total once the cap is close enough to matter — "0 of 90 selected" on
// an empty calendar is noise, not information.
const NEAR_CAP_REMAINING = 10

export interface DatePickerCalendarProps {
  dates: string[]
  onChange: (dates: string[]) => void
  maxDates: number
  maxRangeDays: number
  now?: () => CalendarDate
}

export const DatePickerCalendar = ({
  dates,
  onChange,
  maxDates,
  maxRangeDays,
  now = () => calendarToday(getLocalTimeZone()),
}: DatePickerCalendarProps): React.ReactNode => {
  const min = now()
  const max = min.add({ days: maxRangeDays })
  const value = dates.map((iso) => parseDate(iso))
  const atCap = dates.length >= maxDates
  const showCount = maxDates - dates.length <= NEAR_CAP_REMAINING

  const handleChange = (next: readonly CalendarDate[]): void => {
    onChange(next.map((d) => d.toString()).sort())
  }

  const isUnavailable = (date: DateValue): boolean => {
    if (!atCap) return false
    return !value.some((selected) => selected.toString() === date.toString())
  }

  return (
    <div className="flex flex-col gap-2">
      <Calendar<CalendarDate, 'multiple'>
        aria-label="Candidate dates"
        className="w-full max-w-none"
        isDateUnavailable={isUnavailable}
        maxValue={max}
        minValue={min}
        onChange={handleChange}
        selectionMode="multiple"
        value={value}
      >
        <Calendar.Header className="grid grid-cols-[1.75rem_1fr_1.75rem] items-center">
          <Calendar.NavButton aria-label="Previous month" className={NAV_BUTTON_CLASS} slot="previous">
            ‹
          </Calendar.NavButton>
          <Calendar.Heading className="text-center text-sm font-medium text-[var(--bone)]" />
          <Calendar.NavButton aria-label="Next month" className={NAV_BUTTON_CLASS} slot="next">
            ›
          </Calendar.NavButton>
        </Calendar.Header>
        <Calendar.Grid>
          <Calendar.GridHeader>
            {(day: string) => (
              <Calendar.HeaderCell className="text-xs font-medium text-[var(--slate)]">{day}</Calendar.HeaderCell>
            )}
          </Calendar.GridHeader>
          <Calendar.GridBody>
            {(date: CalendarDate) => (
              <Calendar.Cell className={CELL_CLASS} data-testid={`date-${date.toString()}`} date={date}>
                <span aria-hidden="true">{date.day}</span>
              </Calendar.Cell>
            )}
          </Calendar.GridBody>
        </Calendar.Grid>
      </Calendar>
      {showCount && (
        <p aria-live="polite" className="text-xs text-[var(--slate)]">
          {dates.length} of {maxDates} selected
        </p>
      )}
    </div>
  )
}
