import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import {
  SlotDurationPicker,
  TimeRangeSlider,
  TimesToggle,
  WeekendTimesToggle,
  formatSlotMinutesLabel,
} from './time-fields'

describe('TimesToggle', () => {
  it('marks "Dates only" as selected by default', () => {
    render(<TimesToggle onChange={jest.fn()} usesTimes={false} />)

    expect(screen.getByRole('button', { name: 'Dates only' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Dates & times' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with true when "Dates & times" is pressed', async () => {
    const onChange = jest.fn()
    render(<TimesToggle onChange={onChange} usesTimes={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Dates & times' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })
})

describe('WeekendTimesToggle', () => {
  it('marks "Same time" as selected by default', () => {
    render(<WeekendTimesToggle onChange={jest.fn()} weekendsDiffer={false} />)

    expect(screen.getByRole('button', { name: 'Same time' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Weekends differ' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onChange with true when "Weekends differ" is pressed', async () => {
    const onChange = jest.fn()
    render(<WeekendTimesToggle onChange={onChange} weekendsDiffer={false} />)

    await userEvent.click(screen.getByRole('button', { name: 'Weekends differ' }))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('calls onChange with false when "Same time" is pressed from the differing state', async () => {
    const onChange = jest.fn()
    render(<WeekendTimesToggle onChange={onChange} weekendsDiffer />)

    await userEvent.click(screen.getByRole('button', { name: 'Same time' }))

    expect(onChange).toHaveBeenCalledWith(false)
  })
})

describe('TimeRangeSlider', () => {
  it('defaults its heading to "Time window"', () => {
    render(
      <TimeRangeSlider
        endMinute={1260}
        onChangeEnd={jest.fn()}
        onChangeStart={jest.fn()}
        startMinute={540}
        step={15}
      />,
    )

    expect(screen.getByText('Time window')).toBeInTheDocument()
  })

  it('uses a custom label when provided', () => {
    render(
      <TimeRangeSlider
        endMinute={1260}
        label="Weekends"
        onChangeEnd={jest.fn()}
        onChangeStart={jest.fn()}
        startMinute={540}
        step={15}
      />,
    )

    expect(screen.getByText('Weekends')).toBeInTheDocument()
    expect(screen.queryByText('Time window')).not.toBeInTheDocument()
  })

  it('shows the current start and end as formatted times', () => {
    render(
      <TimeRangeSlider
        endMinute={1260}
        onChangeEnd={jest.fn()}
        onChangeStart={jest.fn()}
        startMinute={540}
        step={15}
      />,
    )

    expect(screen.getByText('9:00 AM')).toBeInTheDocument()
    expect(screen.getByText('9:00 PM')).toBeInTheDocument()
  })

  it("includes the label in each thumb's accessible name, so two on-screen instances stay distinguishable", () => {
    render(
      <TimeRangeSlider
        endMinute={1260}
        label="Weekends"
        onChangeEnd={jest.fn()}
        onChangeStart={jest.fn()}
        startMinute={540}
        step={15}
      />,
    )

    expect(screen.getByLabelText('From (time), Weekends')).toBeInTheDocument()
    expect(screen.getByLabelText('To (time), Weekends')).toBeInTheDocument()
  })

  it('shows an error message when provided', () => {
    render(
      <TimeRangeSlider
        endMinute={600}
        error="Pick a longer time window, or a shorter meeting length."
        onChangeEnd={jest.fn()}
        onChangeStart={jest.fn()}
        startMinute={540}
        step={15}
      />,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/pick a longer time window/i)
  })
})

describe('SlotDurationPicker', () => {
  it('marks the current value as selected', () => {
    render(<SlotDurationPicker allowedSlotMinutes={[15, 30, 60, 90, 120]} onChange={jest.fn()} value={60} />)

    expect(screen.getByRole('button', { name: '1 hr' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('calls onChange with the pressed duration', async () => {
    const onChange = jest.fn()
    render(<SlotDurationPicker allowedSlotMinutes={[15, 30, 60, 90, 120]} onChange={onChange} value={60} />)

    await userEvent.click(screen.getByRole('button', { name: '30 min' }))

    expect(onChange).toHaveBeenCalledWith(30)
  })

  it('labels a 90-minute duration as "1.5 hr"', () => {
    render(<SlotDurationPicker allowedSlotMinutes={[15, 30, 60, 90, 120]} onChange={jest.fn()} value={90} />)

    expect(screen.getByRole('button', { name: '1.5 hr' })).toBeInTheDocument()
  })
})

describe('formatSlotMinutesLabel', () => {
  it('is exported for reuse in the time-window summary line', () => {
    expect(formatSlotMinutesLabel(90)).toBe('1.5 hr')
  })
})
