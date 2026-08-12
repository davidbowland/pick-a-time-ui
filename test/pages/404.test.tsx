import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useRouter } from 'next/router'
import React from 'react'

import AppBar from '@components/app-bar'
import NotFound from '@pages/404'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@components/app-bar')
// The join dialog navigates on a successful lookup, and `useRouter` throws outside a mounted
// router. Nothing here reaches the navigation; this only lets the dialog mount.
jest.mock('next/router', () => ({ useRouter: jest.fn() }))

describe('404 error page', () => {
  /** The name the code control carries: its visible words plus the screen-reader-only extension. */
  const CODE_CONTROL = 'Enter a poll code'

  const renderPage = async (pathname = '/an-invalid-page'): Promise<void> => {
    window.location.pathname = pathname
    // The join dialog runs its lookup through React Query, so the page needs a client even though
    // nothing here submits one -- the dialog mounts the mutation the moment it opens.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    await act(async () => {
      render(
        <QueryClientProvider client={client}>
          <NotFound />
        </QueryClientProvider>,
      )
    })
  }

  beforeAll(() => {
    jest.mocked(AppBar).mockReturnValue(<nav data-testid="app-bar" />)
    jest.mocked(useRouter).mockReturnValue({ push: jest.fn() } as unknown as ReturnType<typeof useRouter>)
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
    expect(await screen.findByText(/may be wrong|may have closed/i)).toBeInTheDocument()
  })

  it('should not render error content when path begins /p/', async () => {
    await renderPage('/p/aeiou')
    expect(screen.queryByText(/may be wrong|may have closed/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(AppBar).not.toHaveBeenCalled()
  })

  it('should render when pathname has three slashes', async () => {
    await renderPage('/p/aeiou/y')
    await waitFor(() => expect(screen.getByText(/may be wrong|may have closed/i)).toBeInTheDocument())
  })

  it('should render a link to home', async () => {
    await renderPage()
    await waitFor(() => expect(screen.getByRole('link', { name: /start a poll/i })).toHaveAttribute('href', '/'))
  })

  it('should reach the code control and then the outbound link by keyboard', async () => {
    await renderPage()

    await userEvent.tab()

    expect(screen.getByRole('button', { name: CODE_CONTROL })).toHaveFocus()

    await userEvent.tab()

    expect(screen.getByRole('link', { name: /start a poll/i })).toHaveFocus()
  })

  it('should offer a way in to somebody who was told the poll code', async () => {
    await renderPage()

    expect(await screen.findByRole('button', { name: CODE_CONTROL })).toBeInTheDocument()
  })

  it('should answer the body copy before offering the way out', async () => {
    // Diagnosis, fix, exit: the body says the link may be wrong, so the fix for that sits under it
    // and the link to start over stays last.
    await renderPage()

    const control = await screen.findByRole('button', { name: CODE_CONTROL })
    const exit = screen.getByRole('link', { name: /start a poll/i })

    expect(control.compareDocumentPosition(exit) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('should open the join dialog from the code control', async () => {
    await renderPage()

    await userEvent.click(await screen.findByRole('button', { name: CODE_CONTROL }))

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('should offer no code control on the poll fallback branch', async () => {
    // The /p/ branch renders nothing on purpose -- the real poll page takes over -- so a trigger
    // there would flash on every poll load.
    await renderPage('/p/aeiou')

    expect(screen.queryByRole('button', { name: CODE_CONTROL })).not.toBeInTheDocument()
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
