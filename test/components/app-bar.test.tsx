import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import React from 'react'

import AppBar from '@components/app-bar'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@components/auth-context')

describe('AppBar', () => {
  // AppBar reads the account's calendar state, so it needs the client `_app` provides in the app.
  function renderAppBar(): ReturnType<typeof render> {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    return render(
      <QueryClientProvider client={queryClient}>
        <AppBar />
      </QueryClientProvider>,
    )
  }

  it('should render the Pick a Time branding', () => {
    renderAppBar()
    expect(screen.getByText('Pick a Time')).toBeInTheDocument()
  })

  it('should link to the home page', () => {
    renderAppBar()
    expect(screen.getByRole('link', { name: 'Pick a Time' })).toHaveAttribute('href', '/')
  })

  it('should render a nav element', () => {
    renderAppBar()
    expect(screen.getByRole('navigation')).toBeInTheDocument()
  })
})
