import { CalendarDate } from '@internationalized/date'
import React from 'react'

import { DatePickerCalendar } from './date-picker'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('DatePickerCalendar', () => {
  const fixedNow = (): CalendarDate => new CalendarDate(2026, 7, 16) // Thursday, 2026-07-16

  it('hides the running total when far from the cap, to avoid overwhelming an empty calendar', () => {
    render(
      <DatePickerCalendar
        dates={['2026-07-16', '2026-07-17']}
        maxDates={90}
        maxRangeDays={365}
        now={fixedNow}
        onChange={jest.fn()}
      />,
    )

    expect(screen.queryByText('2 of 90 selected')).not.toBeInTheDocument()
  })

  it('shows how many of the max dates are selected once the selection is within 10 of the cap', () => {
    render(
      <DatePickerCalendar
        dates={['2026-07-16', '2026-07-17']}
        maxDates={10}
        maxRangeDays={365}
        now={fixedNow}
        onChange={jest.fn()}
      />,
    )

    expect(screen.getByText('2 of 10 selected')).toBeInTheDocument()
  })

  it('renders the day-of-month number for each visible date, not just the selection indicator', () => {
    render(<DatePickerCalendar dates={[]} maxDates={90} maxRangeDays={365} now={fixedNow} onChange={jest.fn()} />)

    expect(screen.getByTestId('date-2026-07-16')).toHaveTextContent('16')
  })

  it('adds a date to the selection when an available day is clicked', async () => {
    const onChange = jest.fn()
    render(<DatePickerCalendar dates={[]} maxDates={90} maxRangeDays={365} now={fixedNow} onChange={onChange} />)

    await userEvent.click(screen.getByTestId('date-2026-07-16'))

    expect(onChange).toHaveBeenCalledWith(['2026-07-16'])
  })

  it('removes a date from the selection when an already-selected day is clicked', async () => {
    const onChange = jest.fn()
    render(
      <DatePickerCalendar dates={['2026-07-16']} maxDates={90} maxRangeDays={365} now={fixedNow} onChange={onChange} />,
    )

    await userEvent.click(screen.getByTestId('date-2026-07-16'))

    expect(onChange).toHaveBeenCalledWith([])
  })

  it('disables dates before today', () => {
    render(<DatePickerCalendar dates={[]} maxDates={90} maxRangeDays={365} now={fixedNow} onChange={jest.fn()} />)

    expect(screen.getByTestId('date-2026-07-15')).toHaveAttribute('aria-disabled', 'true')
  })

  it('visually mutes a disabled (past) date the same way an unavailable (at-cap) date is muted', () => {
    // Pure-CSS behavior with no other jsdom-observable signal — same precedent as this file's
    // own "centered heading" test above and CreateCard's reduced-motion test: assert the utility
    // class that drives the treatment, since jsdom doesn't evaluate the real CSS cascade.
    render(<DatePickerCalendar dates={[]} maxDates={90} maxRangeDays={365} now={fixedNow} onChange={jest.fn()} />)

    expect(screen.getByTestId('date-2026-07-15')).toHaveClass('data-[disabled=true]:text-[var(--slate)]/50')
  })

  it('strikes through a disabled (past) date, not just mutes its color, so it reads as unavailable by more than color alone', () => {
    render(<DatePickerCalendar dates={[]} maxDates={90} maxRangeDays={365} now={fixedNow} onChange={jest.fn()} />)

    expect(screen.getByTestId('date-2026-07-15')).toHaveClass('data-[disabled=true]:line-through')
  })

  it('disables further selection once the max date count is reached, without disabling already-selected dates', () => {
    render(
      <DatePickerCalendar dates={['2026-07-16']} maxDates={1} maxRangeDays={365} now={fixedNow} onChange={jest.fn()} />,
    )

    expect(screen.getByTestId('date-2026-07-17')).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByTestId('date-2026-07-16')).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('disables dates beyond the max range', () => {
    render(<DatePickerCalendar dates={[]} maxDates={90} maxRangeDays={2} now={fixedNow} onChange={jest.fn()} />)

    expect(screen.getByTestId('date-2026-07-19')).toHaveAttribute('aria-disabled', 'true')
  })

  it('lays the header out as a fixed-width prev column, centered heading, fixed-width next column, so the month name is visually centered', () => {
    // This is a pure layout/CSS concern with no other observable signal in jsdom (no real
    // layout engine), so — same precedent as CreateCard's reduced-motion test above — we assert
    // on the utility classes that drive the centering rather than computed positions.
    render(<DatePickerCalendar dates={[]} maxDates={90} maxRangeDays={365} now={fixedNow} onChange={jest.fn()} />)

    const heading = screen.getByText('July 2026')
    expect(heading).toHaveClass('text-center')

    const prevButton = screen.getByRole('button', { name: 'Previous month' })
    expect(prevButton.parentElement).toHaveClass('grid-cols-[1.75rem_1fr_1.75rem]')
  })
})
