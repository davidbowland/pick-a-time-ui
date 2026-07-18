import React from 'react'

import { IntroExplainer } from './elements'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('IntroExplainer', () => {
  it('names the poll, how many dates are candidates, and that no account is needed', () => {
    render(<IntroExplainer dateCount={18} onDismiss={jest.fn()} pollName="Lunch with friends" />)
    expect(screen.getByText(/lunch with friends/i)).toBeInTheDocument()
    expect(screen.getByText(/18/)).toBeInTheDocument()
    expect(screen.getByText(/no account/i)).toBeInTheDocument()
  })

  it('uses grammatically correct singular phrasing for a one-date poll', () => {
    render(<IntroExplainer dateCount={1} onDismiss={jest.fn()} pollName="Lunch with friends" />)
    expect(screen.getByText(/1 date works for you/i)).toBeInTheDocument()
  })

  it('calls onDismiss when acknowledged', async () => {
    const onDismiss = jest.fn()
    render(<IntroExplainer dateCount={18} onDismiss={onDismiss} pollName="Lunch with friends" />)
    await userEvent.click(screen.getByRole('button', { name: /got it/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })
})
