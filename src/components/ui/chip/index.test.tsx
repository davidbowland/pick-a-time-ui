import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { Chip } from './index'

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
})
