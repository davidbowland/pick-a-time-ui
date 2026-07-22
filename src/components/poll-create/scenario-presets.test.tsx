import React from 'react'

import { describePreset, ScenarioPresets } from './scenario-presets'
import '@testing-library/jest-dom'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

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

  it('applies the Weekday dinner preset values when pressed', async () => {
    const onApply = jest.fn()
    render(<ScenarioPresets onApply={onApply} />)

    await userEvent.click(screen.getByRole('button', { name: 'Weekdays Dinner' }))

    expect(onApply).toHaveBeenCalledWith({
      label: 'Weekday dinner',
      short: 'Dinner',
      group: 'weekday',
      weekdays: [1, 2, 3, 4, 5],
      usesTimes: true,
      startMinute: 1050,
      endMinute: 1200,
      slotMinutes: 90,
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

  describe('describePreset', () => {
    it('describes a timed preset in plain language', () => {
      expect(
        describePreset({
          label: 'Weekday dinner',
          short: 'Dinner',
          group: 'weekday',
          weekdays: [1, 2, 3, 4, 5],
          usesTimes: true,
          startMinute: 1050,
          endMinute: 1200,
          slotMinutes: 90,
        }),
      ).toBe('Filled weekdays · dinner 5:30–8:00 PM · 90-minute slots')
    })

    it('describes a no-time preset', () => {
      expect(
        describePreset({
          label: 'Weekends, no time',
          short: 'No time',
          group: 'weekend',
          weekdays: [0, 6],
          usesTimes: false,
        }),
      ).toBe('Filled weekends · no set time')
    })
  })

  describe('momentary quick-fill feedback', () => {
    beforeAll(() => jest.useFakeTimers())
    afterAll(() => jest.useRealTimers())

    it('announces what was filled and flashes the chip, then clears', () => {
      render(<ScenarioPresets onApply={jest.fn()} />)
      const dinner = screen.getByRole('button', { name: 'Weekdays Dinner' })

      fireEvent.click(dinner)

      expect(screen.getByRole('status')).toHaveTextContent('Filled weekdays · dinner 5:30–8:00 PM · 90-minute slots')
      expect(within(dinner).getByText('Filled')).toBeInTheDocument()

      act(() => {
        jest.advanceTimersByTime(1600)
      })

      expect(within(dinner).queryByText('Filled')).not.toBeInTheDocument()
    })

    it('moves the flash to the most recently applied preset', () => {
      render(<ScenarioPresets onApply={jest.fn()} />)
      const lunch = screen.getByRole('button', { name: 'Weekdays Lunch' })
      const dinner = screen.getByRole('button', { name: 'Weekdays Dinner' })

      fireEvent.click(lunch)
      fireEvent.click(dinner)

      expect(within(lunch).queryByText('Filled')).not.toBeInTheDocument()
      expect(within(dinner).getByText('Filled')).toBeInTheDocument()
    })
  })
})
