import React from 'react'

import { EyebrowTag } from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('EyebrowTag', () => {
  it('renders its text content', () => {
    render(<EyebrowTag>09:00 · Try it now</EyebrowTag>)
    expect(screen.getByText('09:00 · Try it now')).toBeInTheDocument()
  })

  it('follows the scroll-driven accent by default', () => {
    render(<EyebrowTag>09:00 · Try it now</EyebrowTag>)
    expect(screen.getByText('09:00 · Try it now')).toHaveClass('text-[var(--eyebrow-accent,var(--accent))]')
  })

  it('pins to the dark-background accent when fixedAccent is set', () => {
    render(<EyebrowTag fixedAccent>New poll</EyebrowTag>)
    expect(screen.getByText('New poll')).toHaveClass('text-[var(--accent)]')
  })
})
