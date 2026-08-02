import React from 'react'

import { CalendarStrip, Toolbar } from './elements'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Toolbar', () => {
  it('should select every cell when Select all is pressed', async () => {
    const onSelectAll = jest.fn()
    render(<Toolbar onClear={jest.fn()} onSelectAll={onSelectAll} />)
    await userEvent.click(screen.getByRole('button', { name: 'Select all' }))
    expect(onSelectAll).toHaveBeenCalledTimes(1)
  })

  it('should clear every cell when Clear all is pressed', async () => {
    const onClear = jest.fn()
    render(<Toolbar onClear={onClear} onSelectAll={jest.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }))
    expect(onClear).toHaveBeenCalledTimes(1)
  })
})

describe('CalendarStrip', () => {
  const now = () => 1_754_006_400_000
  const noop = (): void => undefined
  const base = {
    isChecking: false,
    lastSyncedAt: 1_754_006_280,
    markedBusyCount: 4,
    now,
    onCheckAgain: noop,
    onConnect: noop,
    onDismiss: noop,
    status: 'connected' as const,
    usesTimes: true,
  }

  it('should offer to connect when not connected', () => {
    render(<CalendarStrip {...base} status="not_connected" />)
    expect(screen.getByText("Mark yourself busy where you're already booked")).toBeInTheDocument()
    expect(screen.getByText(/never event titles, guests, or locations/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Not now' })).toBeInTheDocument()
  })

  it('should promise to mark busy, never to remove anything', () => {
    render(<CalendarStrip {...base} status="not_connected" />)
    expect(screen.getByText(/we'll mark you busy wherever it says you're booked/)).toBeInTheDocument()
    // The calendar only ever adds busy time to the poll. Any wording about taking out, removing, or
    // clearing hours describes the opposite of what this feature does.
    expect(screen.queryByText(/take out|remove|clear/i)).not.toBeInTheDocument()
  })

  it('should report the count of hours marked busy', () => {
    render(<CalendarStrip {...base} />)
    expect(screen.getByText('Google Calendar connected')).toBeInTheDocument()
    expect(screen.getByText('Checked 2 minutes ago · marked 4 hours busy')).toBeInTheDocument()
  })

  it('should count a single hour in the singular', () => {
    render(<CalendarStrip {...base} markedBusyCount={1} />)
    expect(screen.getByText('Checked 2 minutes ago · marked 1 hour busy')).toBeInTheDocument()
  })

  it('should claim nothing about conflicts when the count is zero', () => {
    // The count is of hours changed to busy. An hour already busy is already correct and does not
    // increment it, so zero says the grid needed no change -- not that the calendar is clear.
    render(<CalendarStrip {...base} markedBusyCount={0} />)
    expect(screen.getByText('Checked 2 minutes ago')).toBeInTheDocument()
    expect(screen.queryByText(/nothing on your calendar conflicts/)).not.toBeInTheDocument()
    expect(screen.queryByText(/marked .* busy/)).not.toBeInTheDocument()
  })

  it('should not explain the all-day rule when the count is zero', () => {
    render(<CalendarStrip {...base} markedBusyCount={0} usesTimes={false} />)
    expect(screen.getByText('Checked 2 minutes ago')).toBeInTheDocument()
  })

  it('should claim nothing about conflicts when the count is unknown', () => {
    render(<CalendarStrip {...base} markedBusyCount={null} />)
    expect(screen.getByText('Checked 2 minutes ago')).toBeInTheDocument()
    expect(screen.queryByText(/nothing on your calendar conflicts/)).not.toBeInTheDocument()
    expect(screen.queryByText(/marked .* busy/)).not.toBeInTheDocument()
  })

  it('should not explain the all-day rule when the count is unknown', () => {
    render(<CalendarStrip {...base} markedBusyCount={null} usesTimes={false} />)
    expect(screen.getByText('Checked 2 minutes ago')).toBeInTheDocument()
  })

  it('should explain the all-day rule on a date-only poll', () => {
    render(<CalendarStrip {...base} usesTimes={false} />)
    expect(
      screen.getByText("Checked 2 minutes ago · on date-only polls we mark a day busy only when you're booked all day"),
    ).toBeInTheDocument()
  })

  it('should read a missing timestamp as just now', () => {
    render(<CalendarStrip {...base} lastSyncedAt={null} />)
    expect(screen.getByText('Checked just now · marked 4 hours busy')).toBeInTheDocument()
  })

  it('should read the never-synced sentinel as just now, not as 1970', () => {
    // The API stamps lastSyncedAt: 0 at connect and passes it through verbatim, so this -- not
    // null -- is what a freshly connected account actually sends.
    render(<CalendarStrip {...base} lastSyncedAt={0} />)
    expect(screen.getByText('Checked just now · marked 4 hours busy')).toBeInTheDocument()
  })

  it('should show progress while checking', () => {
    render(<CalendarStrip {...base} isChecking />)
    expect(screen.getByText('Checking your calendar…')).toBeInTheDocument()
  })

  it('should announce that a check is under way', () => {
    render(<CalendarStrip {...base} isChecking />)
    expect(screen.getByText('Checking your calendar…')).toHaveAttribute('aria-live', 'polite')
  })

  it('should offer no action while checking', () => {
    render(<CalendarStrip {...base} isChecking />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('should keep the live region across a check so the new count is announced', () => {
    const { rerender } = render(<CalendarStrip {...base} markedBusyCount={1} />)
    const live = screen.getByText('Checked 2 minutes ago · marked 1 hour busy')
    rerender(<CalendarStrip {...base} isChecking markedBusyCount={1} />)
    rerender(<CalendarStrip {...base} markedBusyCount={4} />)
    expect(screen.getByText('Checked 2 minutes ago · marked 4 hours busy')).toBe(live)
  })

  it('should report a failure and reassure that nothing changed', () => {
    render(<CalendarStrip {...base} status="error" />)
    expect(screen.getByText("We couldn't reach Google Calendar")).toBeInTheDocument()
    expect(screen.getByText('Nothing on your grid changed.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
  })

  it('should never offer disconnect, which is account-wide', () => {
    render(<CalendarStrip {...base} />)
    expect(screen.queryByRole('button', { name: /disconnect/i })).not.toBeInTheDocument()
  })

  it('should announce changes to the detail line', () => {
    render(<CalendarStrip {...base} />)
    expect(screen.getByText('Checked 2 minutes ago · marked 4 hours busy')).toHaveAttribute('aria-live', 'polite')
  })

  it('should connect when Connect is pressed', async () => {
    const onConnect = jest.fn()
    render(<CalendarStrip {...base} onConnect={onConnect} status="not_connected" />)
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
    expect(onConnect).toHaveBeenCalledTimes(1)
  })

  it('should dismiss the offer when Not now is pressed', async () => {
    const onDismiss = jest.fn()
    render(<CalendarStrip {...base} onDismiss={onDismiss} status="not_connected" />)
    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('should check again when Check again is pressed', async () => {
    const onCheckAgain = jest.fn()
    render(<CalendarStrip {...base} onCheckAgain={onCheckAgain} />)
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }))
    expect(onCheckAgain).toHaveBeenCalledTimes(1)
  })

  it('should retry from the error state when Try again is pressed', async () => {
    const onCheckAgain = jest.fn()
    render(<CalendarStrip {...base} onCheckAgain={onCheckAgain} status="error" />)
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(onCheckAgain).toHaveBeenCalledTimes(1)
  })
})
