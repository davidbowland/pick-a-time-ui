import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { TimeEditorCoordinatorProvider } from './time-editor-coordinator'
import {
  SlotDurationPicker,
  TimeRangeField,
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

function mockPointer(isCoarse: boolean): void {
  jest.mocked(window.matchMedia).mockReturnValueOnce({
    matches: isCoarse,
    media: '(pointer: coarse)',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  } as unknown as MediaQueryList)
}

describe('TimeRangeField', () => {
  it('defaults its heading to "Time window"', () => {
    render(
      <TimeRangeField endMinute={1260} onChangeEnd={jest.fn()} onChangeStart={jest.fn()} startMinute={540} step={15} />,
    )

    expect(screen.getByText('Time window')).toBeInTheDocument()
  })

  it('uses a custom label when provided', () => {
    render(
      <TimeRangeField
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

  it('shows the current start and end as formatted times in the summary row', () => {
    render(
      <TimeRangeField endMinute={1260} onChangeEnd={jest.fn()} onChangeStart={jest.fn()} startMinute={540} step={15} />,
    )

    expect(screen.getByRole('button', { name: /start time.*9:00 am/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /end time.*9:00 pm/i })).toBeInTheDocument()
  })

  it('marks the matching preset chip as selected and Custom as not selected', () => {
    render(
      <TimeRangeField
        endMinute={1260}
        onChangeEnd={jest.fn()}
        onChangeStart={jest.fn()}
        startMinute={1020}
        step={15}
      />,
    )

    expect(screen.getByRole('button', { name: 'Evening' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('marks Custom as selected when no preset matches the current range', () => {
    render(
      <TimeRangeField endMinute={700} onChangeEnd={jest.fn()} onChangeStart={jest.fn()} startMinute={600} step={15} />,
    )

    expect(screen.getByRole('button', { name: 'Custom' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('applies a preset range when its chip is pressed', async () => {
    const onChangeStart = jest.fn()
    const onChangeEnd = jest.fn()
    render(
      <TimeRangeField
        endMinute={700}
        onChangeEnd={onChangeEnd}
        onChangeStart={onChangeStart}
        startMinute={600}
        step={15}
      />,
    )

    await userEvent.click(screen.getByRole('button', { name: 'Morning' }))

    expect(onChangeStart).toHaveBeenCalledWith(480)
    expect(onChangeEnd).toHaveBeenCalledWith(720)
  })

  it('shows an error message when provided', () => {
    render(
      <TimeRangeField
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

  it("includes the label in each summary button's accessible name, so two on-screen instances stay distinguishable", () => {
    render(
      <TimeRangeField
        endMinute={1260}
        label="Weekends"
        onChangeEnd={jest.fn()}
        onChangeStart={jest.fn()}
        startMinute={540}
        step={15}
      />,
    )

    expect(screen.getByRole('button', { name: /start time, weekends/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /end time, weekends/i })).toBeInTheDocument()
  })

  describe('desktop editor (fine pointer)', () => {
    it('opens native selects scoped to the clicked field and commits on change', async () => {
      mockPointer(false)
      const onChangeStart = jest.fn()
      render(
        <TimeRangeField
          endMinute={1260}
          onChangeEnd={jest.fn()}
          onChangeStart={onChangeStart}
          startMinute={540}
          step={15}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: /start time.*9:00 am/i }))
      await userEvent.selectOptions(screen.getByLabelText('Hour'), '10')

      expect(onChangeStart).toHaveBeenCalledWith(600)
    })

    it('keeps the editor open after a single select change, so a second field can also be adjusted', async () => {
      mockPointer(false)
      const onChangeStart = jest.fn()
      render(
        <TimeRangeField
          endMinute={1260}
          onChangeEnd={jest.fn()}
          onChangeStart={onChangeStart}
          startMinute={540}
          step={15}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: /start time.*9:00 am/i }))
      await userEvent.selectOptions(screen.getByLabelText('Hour'), '10')
      await userEvent.selectOptions(screen.getByLabelText('Minute'), '30')

      expect(onChangeStart).toHaveBeenNthCalledWith(1, 600)
      expect(onChangeStart).toHaveBeenNthCalledWith(2, 630)
    })

    it('disables the chips while the editor is open', async () => {
      mockPointer(false)
      render(
        <TimeRangeField
          endMinute={1260}
          onChangeEnd={jest.fn()}
          onChangeStart={jest.fn()}
          startMinute={540}
          step={15}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: /start time.*9:00 am/i }))

      expect(screen.getByRole('button', { name: 'Morning' })).toBeDisabled()
    })

    it("disables the other field's chips too, when two fields share one coordinator provider", async () => {
      mockPointer(false)
      render(
        <TimeEditorCoordinatorProvider>
          <TimeRangeField
            endMinute={1260}
            label="Weekdays"
            onChangeEnd={jest.fn()}
            onChangeStart={jest.fn()}
            startMinute={540}
            step={15}
          />
          <TimeRangeField
            endMinute={1260}
            label="Weekends"
            onChangeEnd={jest.fn()}
            onChangeStart={jest.fn()}
            startMinute={540}
            step={15}
          />
        </TimeEditorCoordinatorProvider>,
      )

      await userEvent.click(screen.getByRole('button', { name: /start time, weekdays.*9:00 am/i }))

      const morningChips = screen.getAllByRole('button', { name: 'Morning' })
      expect(morningChips).toHaveLength(2)
      morningChips.forEach((chip) => expect(chip).toBeDisabled())
    })

    it('closes without committing when Escape is pressed', async () => {
      mockPointer(false)
      const onChangeStart = jest.fn()
      render(
        <TimeRangeField
          endMinute={1260}
          onChangeEnd={jest.fn()}
          onChangeStart={onChangeStart}
          startMinute={540}
          step={15}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: /start time.*9:00 am/i }))
      await userEvent.keyboard('{Escape}')

      expect(onChangeStart).not.toHaveBeenCalled()
      expect(screen.queryByLabelText('Hour')).not.toBeInTheDocument()
    })

    it('returns focus to the summary button that opened the editor once it closes', async () => {
      mockPointer(false)
      render(
        <TimeRangeField
          endMinute={1260}
          onChangeEnd={jest.fn()}
          onChangeStart={jest.fn()}
          startMinute={540}
          step={15}
        />,
      )

      const startButton = screen.getByRole('button', { name: /start time.*9:00 am/i })
      await userEvent.click(startButton)
      await userEvent.keyboard('{Escape}')

      expect(screen.getByRole('button', { name: /start time.*9:00 am/i })).toHaveFocus()
    })
  })

  describe('touch editor (coarse pointer)', () => {
    it('opens a wheel picker and commits the selected time on Done', async () => {
      mockPointer(true)
      const onChangeStart = jest.fn()
      render(
        <TimeRangeField
          endMinute={1260}
          onChangeEnd={jest.fn()}
          onChangeStart={onChangeStart}
          startMinute={540}
          step={15}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: /start time.*9:00 am/i }))
      screen.getByRole('listbox', { name: 'Hour' }).focus()
      await userEvent.keyboard('{ArrowDown}')
      await userEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(onChangeStart).toHaveBeenCalledWith(600)
    })

    it('closes without committing when Cancel is pressed', async () => {
      mockPointer(true)
      const onChangeStart = jest.fn()
      render(
        <TimeRangeField
          endMinute={1260}
          onChangeEnd={jest.fn()}
          onChangeStart={onChangeStart}
          startMinute={540}
          step={15}
        />,
      )

      await userEvent.click(screen.getByRole('button', { name: /start time.*9:00 am/i }))
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onChangeStart).not.toHaveBeenCalled()
      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
    })
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
