import React from 'react'

import AppBar from '@components/app-bar'
import NotFound from '@pages/404'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'

jest.mock('@components/app-bar')

describe('404 error page', () => {
  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<nav data-testid="app-bar" />)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '' },
    })
  })

  beforeEach(() => {
    window.location.pathname = '/an-invalid-page'
  })

  it('should render AppBar for non-session paths', async () => {
    await act(async () => {
      render(<NotFound />)
    })
    await waitFor(() => expect(AppBar).toHaveBeenCalled())
  })

  it('should render heading', async () => {
    await act(async () => {
      render(<NotFound />)
    })
    await waitFor(() => expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument())
  })

  it('should render error message', async () => {
    await act(async () => {
      render(<NotFound />)
    })
    expect(await screen.findByText(/expired|mistyped/i)).toBeInTheDocument()
  })

  it('should not render error content when path begins /p/', async () => {
    window.location.pathname = '/p/aeiou'
    await act(async () => {
      render(<NotFound />)
    })
    expect(screen.queryByText(/expired|mistyped/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(AppBar).not.toHaveBeenCalled()
  })

  it('should render when pathname has three slashes', async () => {
    window.location.pathname = '/p/aeiou/y'
    await act(async () => {
      render(<NotFound />)
    })
    await waitFor(() => expect(screen.getByText(/expired|mistyped/i)).toBeInTheDocument())
  })

  it('should render a link to home', async () => {
    await act(async () => {
      render(<NotFound />)
    })
    await waitFor(() => expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/'))
  })
})
