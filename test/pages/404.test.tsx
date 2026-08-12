import React from 'react'

import AppBar from '@components/app-bar'
import NotFound from '@pages/404'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@components/app-bar')

describe('404 error page', () => {
  const renderPage = async (pathname = '/an-invalid-page'): Promise<void> => {
    window.location.pathname = pathname
    await act(async () => {
      render(<NotFound />)
    })
  }

  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<nav data-testid="app-bar" />)
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { pathname: '' },
    })
  })

  it('should render AppBar for non-session paths', async () => {
    await renderPage()
    await waitFor(() => expect(AppBar).toHaveBeenCalled())
  })

  it('should render heading', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument())
  })

  it('should render error message', async () => {
    await renderPage()
    expect(await screen.findByText(/expired|mistyped/i)).toBeInTheDocument()
  })

  it('should not render error content when path begins /p/', async () => {
    await renderPage('/p/aeiou')
    expect(screen.queryByText(/expired|mistyped/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(AppBar).not.toHaveBeenCalled()
  })

  it('should render when pathname has three slashes', async () => {
    await renderPage('/p/aeiou/y')
    await waitFor(() => expect(screen.getByText(/expired|mistyped/i)).toBeInTheDocument())
  })

  it('should render a link to home', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByRole('link', { name: /go home/i })).toHaveAttribute('href', '/'))
  })

  it('should put the home link in the keyboard tab order', async () => {
    await renderPage()

    await userEvent.tab()

    expect(screen.getByRole('link', { name: /go home/i })).toHaveFocus()
  })

  it('should exclude the error page from search indexes', async () => {
    await renderPage()
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow'),
    )
  })

  it('should exclude the poll fallback from search indexes', async () => {
    await renderPage('/p/aeiou')
    await waitFor(() =>
      expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow'),
    )
  })
})
