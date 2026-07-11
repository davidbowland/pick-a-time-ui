import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import AppBar from '@components/app-bar'

jest.mock('@components/auth-context')

describe('AppBar', () => {
  it('should render the Choosee branding', () => {
    render(<AppBar />)
    expect(screen.getByText('Choosee')).toBeInTheDocument()
  })

  it('should link to the home page', () => {
    render(<AppBar />)
    expect(screen.getByRole('link', { name: 'Choosee' })).toHaveAttribute('href', '/')
  })

  it('should render a nav element', () => {
    render(<AppBar />)
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
