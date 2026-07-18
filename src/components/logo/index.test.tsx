import React from 'react'

import Logo from './index'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('Logo component', () => {
  it('should display the title', async () => {
    render(<Logo />)

    expect(await screen.getByText('Pick a Time')).toBeInTheDocument()
  })
})
