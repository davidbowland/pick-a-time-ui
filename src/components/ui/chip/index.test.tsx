import React from 'react'

import { Chip } from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('Chip', () => {
  it('renders as a real button and calls onPress when clicked', async () => {
    const onPress = jest.fn()
    render(<Chip onPress={onPress}>Thu</Chip>)
    await userEvent.click(screen.getByRole('button', { name: 'Thu' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('omits aria-pressed entirely when selected is not passed', () => {
    render(<Chip onPress={jest.fn()}>Clear all</Chip>)
    expect(screen.getByRole('button', { name: 'Clear all' })).not.toHaveAttribute('aria-pressed')
  })

  it('marks a selected chip with aria-pressed', () => {
    render(
      <Chip onPress={jest.fn()} selected>
        Thu
      </Chip>,
    )
    expect(screen.getByRole('button', { name: 'Thu' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders as a non-interactive span when used decoratively', () => {
    render(<Chip as="span">Thu</Chip>)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
    expect(screen.getByText('Thu')).toBeInTheDocument()
  })

  it('exposes aria-label as the accessible name', () => {
    render(
      <Chip aria-label="Next week" onPress={jest.fn()}>
        →
      </Chip>,
    )
    expect(screen.getByRole('button', { name: 'Next week' })).toBeInTheDocument()
  })

  it('renders a functionally disabled button that does not call onPress when clicked', async () => {
    const onPress = jest.fn()
    render(
      <Chip aria-label="Next week" disabled onPress={onPress}>
        →
      </Chip>,
    )
    const button = screen.getByRole('button', { name: 'Next week' })
    expect(button).toBeDisabled()
    await userEvent.click(button)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('emphasizes a primary chip without claiming a toggle state', async () => {
    const onPress = jest.fn()
    render(
      <Chip onPress={onPress} primary>
        Connect
      </Chip>,
    )
    const button = screen.getByRole('button', { name: 'Connect' })
    expect(button).not.toHaveAttribute('aria-pressed')
    await userEvent.click(button)
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('reports the state it has when a caller wrongly passes primary and selected together', () => {
    render(
      // @ts-expect-error primary is emphasis, selected is a toggle state; a chip is one or the other
      <Chip onPress={jest.fn()} primary selected>
        Connect
      </Chip>,
    )
    expect(screen.getByRole('button', { name: 'Connect' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps an aria-disabled chip in the tab order with its reason on screen', async () => {
    render(
      <>
        <Chip aria-describedby="fill-reason" aria-disabled onPress={jest.fn()}>
          Fill in what&apos;s free
        </Chip>
        <p id="fill-reason">You can fill in what&apos;s free once the check finishes.</p>
      </>,
    )
    const button = screen.getByRole('button', { name: "Fill in what's free" })
    expect(button).toHaveAttribute('aria-disabled', 'true')
    expect(button).not.toBeDisabled()
    await userEvent.tab()
    expect(button).toHaveFocus()
    expect(button).toHaveAccessibleDescription("You can fill in what's free once the check finishes.")
  })

  it('does not call onPress from a click or a keypress while aria-disabled', async () => {
    const onPress = jest.fn()
    render(
      <Chip aria-disabled onPress={onPress}>
        Fill in what&apos;s free
      </Chip>,
    )
    const button = screen.getByRole('button', { name: "Fill in what's free" })
    await userEvent.click(button)
    button.focus()
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard(' ')
    expect(onPress).not.toHaveBeenCalled()
  })
})
