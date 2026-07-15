import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import AppBar from './index'
import { useAuthContext } from '@components/auth-context'
import { clearSessionCookie } from '@hooks/useSessionCookie'

jest.mock('@components/auth-context')
jest.mock('@hooks/useSessionCookie')

describe('AppBar', () => {
  const handleSignOut = jest.fn()
  const handleSignIn = jest.fn()

  function setupSignedIn(): void {
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: true,
      user: { name: 'Alex', phone: null },
      isLoading: false,
      handleSignIn,
      handleSignOut,
    })
  }

  function setupSignedOut(): void {
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: false,
      user: null,
      isLoading: false,
      handleSignIn,
      handleSignOut,
    })
  }

  it('clears the poll cookie and signs out when a sessionId is present', async () => {
    setupSignedIn()

    render(<AppBar sessionId="amber-harbor" />)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(clearSessionCookie).toHaveBeenCalledWith('amber-harbor')
    expect(handleSignOut).toHaveBeenCalled()
  })

  it('signs out without touching any cookie when no sessionId is present', async () => {
    setupSignedIn()

    render(<AppBar />)
    await userEvent.click(screen.getByRole('button', { name: /sign out/i }))

    expect(clearSessionCookie).not.toHaveBeenCalled()
    expect(handleSignOut).toHaveBeenCalled()
  })

  it('shows the Google sign-in button when signed out', () => {
    setupSignedOut()

    render(<AppBar />)

    expect(screen.getByRole('button', { name: /sign in with google/i })).toBeInTheDocument()
  })
})
