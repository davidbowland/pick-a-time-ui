import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { ScenarioPresets } from './scenario-presets'

describe('ScenarioPresets', () => {
  it('applies the Weekday lunch preset values when pressed', async () => {
    const onApply = jest.fn()
    render(<ScenarioPresets onApply={onApply} />)

    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Lunch' }))

    expect(onApply).toHaveBeenCalledWith({
      label: 'Weekday lunch',
      short: 'Lunch',
      group: 'weekday',
      weekdays: [1, 2, 3, 4, 5],
      usesTimes: true,
      startMinute: 690,
      endMinute: 810,
      slotMinutes: 60,
    })
  })

  it('applies the Weekend dinner preset as Friday-Saturday evening', async () => {
    const onApply = jest.fn()
    render(<ScenarioPresets onApply={onApply} />)

    await userEvent.click(screen.getByRole('button', { name: 'Weekends Dinner' }))

    expect(onApply).toHaveBeenCalledWith({
      label: 'Weekend dinner',
      short: 'Dinner',
      group: 'weekend',
      weekdays: [5, 6],
      usesTimes: true,
      startMinute: 1080,
      endMinute: 1260,
      slotMinutes: 90,
    })
  })

  it('applies the weekday dates-only preset with usesTimes false and no time fields', async () => {
    const onApply = jest.fn()
    render(<ScenarioPresets onApply={onApply} />)

    await userEvent.click(screen.getByRole('button', { name: 'Weekdays No time' }))

    expect(onApply).toHaveBeenCalledWith({
      label: 'Weekdays, no time',
      short: 'No time',
      group: 'weekday',
      weekdays: [1, 2, 3, 4, 5],
      usesTimes: false,
    })
  })

  it('applies the weekend dates-only preset with usesTimes false and no time fields', async () => {
    const onApply = jest.fn()
    render(<ScenarioPresets onApply={onApply} />)

    await userEvent.click(screen.getByRole('button', { name: 'Weekends No time' }))

    expect(onApply).toHaveBeenCalledWith({
      label: 'Weekends, no time',
      short: 'No time',
      group: 'weekend',
      weekdays: [0, 6],
      usesTimes: false,
    })
  })

  it('groups chips under a Weekdays heading and a Weekends heading', () => {
    render(<ScenarioPresets onApply={jest.fn()} />)

    expect(screen.getByRole('group', { name: 'Weekdays' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Weekends' })).toBeInTheDocument()
  })

  it('never marks a preset as pressed/selected, since presets are one-shot actions, not persistent state', async () => {
    render(<ScenarioPresets onApply={jest.fn()} />)
    const button = screen.getByRole('button', { name: 'Weekdays Lunch' })

    await userEvent.click(button)

    expect(button).not.toHaveAttribute('aria-pressed')
  })

  it('shows the quick-fill heading and hint, not "patterns" jargon', () => {
    render(<ScenarioPresets onApply={jest.fn()} />)

    expect(screen.getByText('Quick-fill (optional)')).toBeInTheDocument()
    expect(screen.getByText('Tap to fill in the days, dates, and time below.')).toBeInTheDocument()
  })
})
