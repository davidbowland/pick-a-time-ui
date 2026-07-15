import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { PillButton } from './index'

describe('PillButton', () => {
  it('calls onPress when clicked', async () => {
    const onPress = jest.fn()
    render(<PillButton label="Start a poll" onPress={onPress} />)
    await userEvent.click(screen.getByRole('button', { name: 'Start a poll' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('shows the loading label and disables the button while loading', () => {
    render(<PillButton isLoading label="Start a poll" loadingLabel="Starting..." onPress={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Starting...' })).toBeDisabled()
  })

  it('disables the button when isDisabled is set', () => {
    render(<PillButton isDisabled label="Continue" onPress={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled()
  })

  it('defaults to the primary variant when variant is omitted', () => {
    render(<PillButton label="Try it now" onPress={jest.fn()} />)
    expect(screen.getByRole('button', { name: 'Try it now' })).toHaveAttribute('data-variant', 'primary')
  })

  it('renders the ghost variant when variant is set to ghost', () => {
    render(<PillButton label="Try it now" onPress={jest.fn()} variant="ghost" />)
    expect(screen.getByRole('button', { name: 'Try it now' })).toHaveAttribute('data-variant', 'ghost')
  })
})
