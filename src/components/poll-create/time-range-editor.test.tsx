import '@testing-library/jest-dom'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { TimeRangeEditor } from './time-range-editor'

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

describe('TimeRangeEditor', () => {
  describe('fine pointer (desktop)', () => {
    it('renders native selects seeded from the given minute', () => {
      mockPointer(false)
      render(
        <TimeRangeEditor fieldLabel="Start time" minute={555} onCancel={jest.fn()} onCommit={jest.fn()} step={15} />,
      )

      expect(screen.getByLabelText('Hour')).toHaveValue('9')
      expect(screen.getByLabelText('Minute')).toHaveValue('15')
      expect(screen.getByLabelText('AM or PM')).toHaveValue('AM')
    })

    it('commits immediately when a select changes', async () => {
      mockPointer(false)
      const onCommit = jest.fn()
      render(
        <TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={jest.fn()} onCommit={onCommit} step={15} />,
      )

      await userEvent.selectOptions(screen.getByLabelText('Hour'), '10')

      expect(onCommit).toHaveBeenCalledWith(600)
    })

    it('only offers minute options aligned to the given step', () => {
      mockPointer(false)
      render(
        <TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={jest.fn()} onCommit={jest.fn()} step={30} />,
      )

      const options = within(screen.getByLabelText('Minute')).getAllByRole('option')
      expect(options.map((option) => option.textContent)).toEqual(['00', '30'])
    })

    it('still offers at least one minute option when step is 60 or greater', () => {
      mockPointer(false)
      render(
        <TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={jest.fn()} onCommit={jest.fn()} step={90} />,
      )

      const options = within(screen.getByLabelText('Minute')).getAllByRole('option')
      expect(options.length).toBeGreaterThanOrEqual(1)
    })

    it('does not render Cancel/Done buttons', () => {
      mockPointer(false)
      render(
        <TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={jest.fn()} onCommit={jest.fn()} step={15} />,
      )

      expect(screen.queryByRole('button', { name: 'Done' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
    })
  })

  describe('coarse pointer (touch)', () => {
    it('renders wheel columns seeded from the given minute', () => {
      mockPointer(true)
      render(
        <TimeRangeEditor fieldLabel="Start time" minute={555} onCancel={jest.fn()} onCommit={jest.fn()} step={15} />,
      )

      expect(screen.getByRole('option', { name: '9', selected: true })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: '15', selected: true })).toBeInTheDocument()
      expect(screen.getByRole('option', { name: 'AM', selected: true })).toBeInTheDocument()
    })

    it('does not commit until Done is pressed', async () => {
      mockPointer(true)
      const onCommit = jest.fn()
      render(
        <TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={jest.fn()} onCommit={onCommit} step={15} />,
      )

      screen.getByRole('listbox', { name: 'Hour' }).focus()
      await userEvent.keyboard('{ArrowDown}')

      expect(onCommit).not.toHaveBeenCalled()

      await userEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(onCommit).toHaveBeenCalledWith(600)
    })

    it('also calls onCancel when Done is pressed, so the parent can close the editor', async () => {
      mockPointer(true)
      const onCancel = jest.fn()
      render(
        <TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={onCancel} onCommit={jest.fn()} step={15} />,
      )

      await userEvent.click(screen.getByRole('button', { name: 'Done' }))

      expect(onCancel).toHaveBeenCalled()
    })

    it('calls onCancel without committing when Cancel is pressed', async () => {
      mockPointer(true)
      const onCommit = jest.fn()
      const onCancel = jest.fn()
      render(<TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={onCancel} onCommit={onCommit} step={15} />)

      screen.getByRole('listbox', { name: 'Hour' }).focus()
      await userEvent.keyboard('{ArrowDown}')
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

      expect(onCommit).not.toHaveBeenCalled()
      expect(onCancel).toHaveBeenCalled()
    })
  })

  it('calls onCancel when Escape is pressed', async () => {
    mockPointer(false)
    const onCancel = jest.fn()
    render(<TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={onCancel} onCommit={jest.fn()} step={15} />)

    await userEvent.keyboard('{Escape}')

    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when the backdrop is clicked', async () => {
    mockPointer(false)
    const onCancel = jest.fn()
    const { container } = render(
      <TimeRangeEditor fieldLabel="Start time" minute={540} onCancel={onCancel} onCommit={jest.fn()} step={15} />,
    )

    // The backdrop is the first child: a full-viewport click-catcher rendered before the
    // editor content itself.
    await userEvent.click(container.firstElementChild as HTMLElement)

    expect(onCancel).toHaveBeenCalled()
  })

  it('uses fieldLabel as the accessible name of the editor region', () => {
    mockPointer(false)
    render(
      <TimeRangeEditor
        fieldLabel="Weekend end time"
        minute={540}
        onCancel={jest.fn()}
        onCommit={jest.fn()}
        step={15}
      />,
    )

    expect(screen.getByRole('group', { name: 'Weekend end time' })).toBeInTheDocument()
  })
})
