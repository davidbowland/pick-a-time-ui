import React from 'react'

import { DoubleBezelCard } from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('DoubleBezelCard', () => {
  it('renders its children', () => {
    render(
      <DoubleBezelCard>
        <p>Poll details</p>
      </DoubleBezelCard>,
    )
    expect(screen.getByText('Poll details')).toBeInTheDocument()
  })

  it('merges an additional className onto the inner core', () => {
    render(
      <DoubleBezelCard className="p-6">
        <p>Content</p>
      </DoubleBezelCard>,
    )
    expect(screen.getByText('Content').parentElement).toHaveClass('p-6')
  })
})
