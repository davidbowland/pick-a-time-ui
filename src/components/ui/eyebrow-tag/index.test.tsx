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

  it('borders in the same color as its text, so the outline is never less visible than the label', () => {
    render(<EyebrowTag>09:00 · Try it now</EyebrowTag>)
    expect(screen.getByText('09:00 · Try it now')).toHaveClass('border-[var(--eyebrow-accent,var(--accent))]')
  })

  it('pins the border to the dark-background accent when fixedAccent is set', () => {
    render(<EyebrowTag fixedAccent>New poll</EyebrowTag>)
    expect(screen.getByText('New poll')).toHaveClass('border-[var(--accent)]')
  })

  it('fills solid with the guaranteed-AA copy-color chip, not a translucent tint', () => {
    render(<EyebrowTag>09:00 · Try it now</EyebrowTag>)
    expect(screen.getByText('09:00 · Try it now')).toHaveClass('bg-[var(--copy-color,var(--ink))]')
  })

  it('pins the chip to ink when fixedAccent is set', () => {
    render(<EyebrowTag fixedAccent>New poll</EyebrowTag>)
    expect(screen.getByText('New poll')).toHaveClass('bg-[var(--ink)]')
  })

  it('gives the dot the same scroll-driven accent as the text, so it reads against the chip', () => {
    const { container } = render(<EyebrowTag>09:00 · Try it now</EyebrowTag>)
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-[var(--eyebrow-accent,var(--accent))]')
  })

  it('pins the dot to the dark-background accent when fixedAccent is set', () => {
    const { container } = render(<EyebrowTag fixedAccent>New poll</EyebrowTag>)
    expect(container.querySelector('[aria-hidden="true"]')).toHaveClass('bg-[var(--accent)]')
  })
})
