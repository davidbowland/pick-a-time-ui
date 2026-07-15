import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { IntroExplainer, WhatIsThisToggle } from './elements'

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

describe('WhatIsThisToggle', () => {
  it('is collapsed by default and expands aria-expanded when open', () => {
    render(
      <WhatIsThisToggle
        dateCount={18}
        hasJoined={false}
        isOpen={false}
        onToggle={jest.fn()}
        pollName="Lunch with friends"
      />,
    )
    expect(screen.getByRole('button', { name: /what is this/i })).toHaveAttribute('aria-expanded', 'false')
  })

  it('shows the explainer content only when open', () => {
    const { rerender } = render(
      <WhatIsThisToggle
        dateCount={18}
        hasJoined={false}
        isOpen={false}
        onToggle={jest.fn()}
        pollName="Lunch with friends"
      />,
    )
    expect(screen.queryByText(/no account/i)).not.toBeInTheDocument()

    rerender(
      <WhatIsThisToggle dateCount={18} hasJoined={false} isOpen onToggle={jest.fn()} pollName="Lunch with friends" />,
    )
    expect(screen.getByText(/no account/i)).toBeInTheDocument()
  })

  it('calls onToggle when clicked', async () => {
    const onToggle = jest.fn()
    render(
      <WhatIsThisToggle
        dateCount={18}
        hasJoined={false}
        isOpen={false}
        onToggle={onToggle}
        pollName="Lunch with friends"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /what is this/i }))
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('drops the "jump in / no account" framing once the voter has already joined', () => {
    render(<WhatIsThisToggle dateCount={18} hasJoined isOpen onToggle={jest.fn()} pollName="Lunch with friends" />)
    expect(screen.queryByText(/no account/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/jump in/i)).not.toBeInTheDocument()
    expect(screen.getByText(/mark which of these 18 dates work for you/i)).toBeInTheDocument()
  })

  it('uses grammatically correct singular phrasing for a one-date poll once joined', () => {
    render(<WhatIsThisToggle dateCount={1} hasJoined isOpen onToggle={jest.fn()} pollName="Lunch with friends" />)
    expect(screen.getByText(/1 date works for you/i)).toBeInTheDocument()
  })
})
