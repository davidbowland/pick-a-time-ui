// src/components/story/closing-footer/index.test.tsx
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import { ClosingFooter } from './index'

describe('ClosingFooter', () => {
  it('calls onBackToStart when the CTA is clicked', async () => {
    const onBackToStart = jest.fn()
    render(<ClosingFooter onBackToStart={onBackToStart} />)
    await userEvent.click(screen.getByRole('button', { name: /start a poll/i }))
    expect(onBackToStart).toHaveBeenCalledTimes(1)
  })
})
