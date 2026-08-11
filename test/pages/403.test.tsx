import React from 'react'

import AppBar from '@components/app-bar'
import Forbidden from '@pages/403'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@components/app-bar')

describe('403 error page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<nav data-testid="app-bar" />)
  })

  it('should render AppBar', () => {
    render(<Forbidden />)
    expect(AppBar).toHaveBeenCalled()
  })

  it('should render heading', () => {
    render(<Forbidden />)
    expect(screen.getByRole('heading', { name: /you don't have access/i })).toBeInTheDocument()
  })

  it('should render error message', () => {
    render(<Forbidden />)
    expect(screen.getByText(/not allowed/i)).toBeInTheDocument()
  })

  it('should render a link to home', () => {
    render(<Forbidden />)
    expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/')
  })

  it('should put the home link in the keyboard tab order', async () => {
    render(<Forbidden />)

    await userEvent.tab()

    expect(screen.getByRole('link', { name: /go home/i })).toHaveFocus()
  })

  it('should exclude the page from search indexes', () => {
    render(<Forbidden />)
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  })
})
