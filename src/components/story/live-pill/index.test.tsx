import React from 'react'

import { LivePill } from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('LivePill', () => {
  it('conveys "live" as text, not by color alone', () => {
    render(<LivePill />)
    expect(screen.getByText(/live/i)).toBeInTheDocument()
  })
})
