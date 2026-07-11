import BadRequest from '@pages/400'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import AppBar from '@components/app-bar'

jest.mock('@components/app-bar')

describe('400 error page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<nav data-testid="app-bar" />)
  })

  it('should render AppBar', () => {
    render(<BadRequest />)
    expect(AppBar).toHaveBeenCalled()
  })

  it('should render heading', () => {
    render(<BadRequest />)
    expect(screen.getByRole('heading', { name: /something went wrong/i })).toBeInTheDocument()
  })

  it('should render error message', () => {
    render(<BadRequest />)
    expect(screen.getByText(/couldn't process/i)).toBeInTheDocument()
  })

  it('should render a link to home', () => {
    render(<BadRequest />)
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/')
  })
})
