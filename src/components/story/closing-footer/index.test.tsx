// src/components/story/closing-footer/index.test.tsx
import React from 'react'

import { ClosingFooter } from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

describe('ClosingFooter', () => {
  it('calls onBackToStart when the CTA is clicked', async () => {
    const onBackToStart = jest.fn()
    render(<ClosingFooter onBackToStart={onBackToStart} />)
    await userEvent.click(screen.getByRole('button', { name: /start a poll/i }))
    expect(onBackToStart).toHaveBeenCalledTimes(1)
  })

  it('heads the footer at h2 by default', () => {
    render(<ClosingFooter onBackToStart={jest.fn()} />)
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('Now go find the time that works.')
  })

  it('takes the level down to h3 when the story is collapsed under another surface heading', () => {
    // Hardcoding h2 here left the collapsed story outranking the control it lives inside — D-30,
    // and half of why AC-048 was unreachable by any section as originally scoped.
    render(<ClosingFooter headingLevel="h3" onBackToStart={jest.fn()} />)
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Now go find the time that works.')
  })

  it('can head the footer at h1', () => {
    render(<ClosingFooter headingLevel="h1" onBackToStart={jest.fn()} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Now go find the time that works.')
  })
})
