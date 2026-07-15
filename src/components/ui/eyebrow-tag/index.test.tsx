import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { EyebrowTag } from './index'

describe('EyebrowTag', () => {
  it('renders its text content', () => {
    render(<EyebrowTag>09:00 · Try it now</EyebrowTag>)
    expect(screen.getByText('09:00 · Try it now')).toBeInTheDocument()
  })
})
