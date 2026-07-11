import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import Logo from './index'

describe('Logo component', () => {
  it('should display the title', async () => {
    render(<Logo />)

    expect(await screen.getByText('Choosee')).toBeInTheDocument()
  })
})
