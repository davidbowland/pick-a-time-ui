import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from 'aws-amplify/api'
import React from 'react'

import IdentityPhase, { IdentityPhaseProps } from './index'
import { useAuthContext } from '@components/auth-context'
import { createUser } from '@services/api'

jest.mock('@components/auth-context')
jest.mock('@services/api', () => ({
  ...jest.requireActual('@services/api'),
  createUser: jest.fn(),
}))

function renderWithClient(props: IdentityPhaseProps): ReturnType<typeof render> {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <IdentityPhase {...props} />
    </QueryClientProvider>,
  )
}

describe('IdentityPhase', () => {
  const onUserSelected = jest.fn()
  const users = [{ userId: 'quiet-falcon', name: null, phone: null, textsSent: 0 }]

  function setup(): void {
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: false,
      user: null,
      isLoading: false,
      handleSignIn: jest.fn(),
      handleSignOut: jest.fn(),
    })
  }

  function setupAuthLoading(): void {
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: false,
      user: null,
      isLoading: true,
      handleSignIn: jest.fn(),
      handleSignOut: jest.fn(),
    })
  }

  function setupSignedIn(): void {
    jest.mocked(useAuthContext).mockReturnValue({
      isSignedIn: true,
      user: { name: 'Google User', phone: null },
      isLoading: false,
      handleSignIn: jest.fn(),
      handleSignOut: jest.fn(),
    })
  }

  it('should list existing users by their title-cased name', () => {
    setup()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })

    expect(screen.getByText('Quiet Falcon')).toBeInTheDocument()
  })

  it('should call onUserSelected with the existing userId after selecting and confirming', async () => {
    setup()

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })
    await userEvent.click(screen.getByRole('radio', { name: 'Quiet Falcon' }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(onUserSelected).toHaveBeenCalledWith('quiet-falcon')
  })

  it('should call onUserSelected with the new userId after creating one', async () => {
    setup()
    jest.mocked(createUser).mockResolvedValueOnce({ userId: 'bright-heron', name: null, phone: null, textsSent: 0 })

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })
    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onUserSelected).toHaveBeenCalledWith('bright-heron'))
  })

  it('should show a full-group error message on 400', async () => {
    setup()
    const error = Object.assign(new Error('full'), {
      response: { statusCode: 400, headers: {}, body: JSON.stringify({ message: 'This group is full.' }) },
    })
    Object.setPrototypeOf(error, ApiError.prototype)
    jest.mocked(createUser).mockRejectedValueOnce(error)

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })
    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText('This group is full.')).toBeInTheDocument()
  })

  it('should show a generic error message on non-400 failure', async () => {
    setup()
    jest.mocked(createUser).mockRejectedValueOnce(new Error('Network error'))

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })
    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    expect(await screen.findByText("Couldn't join. Try again.")).toBeInTheDocument()
  })

  it('should auto-create a user when the group starts empty', async () => {
    setup()
    jest.mocked(createUser).mockResolvedValueOnce({ userId: 'bright-heron', name: null, phone: null, textsSent: 0 })

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users: [] })

    await waitFor(() => expect(createUser).toHaveBeenCalledWith('amber-harbor', false))
    await waitFor(() => expect(onUserSelected).toHaveBeenCalledWith('bright-heron'))
  })

  it('should only call createUser once even across re-renders while the group is empty', async () => {
    setup()
    jest.mocked(createUser).mockResolvedValue({ userId: 'bright-heron', name: null, phone: null, textsSent: 0 })

    const { rerender } = renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users: [] })
    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <IdentityPhase onUserSelected={onUserSelected} sessionId="amber-harbor" users={[]} />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(createUser).toHaveBeenCalledTimes(1))
  })

  it('should not auto-create while auth is still loading', () => {
    setupAuthLoading()

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users: [] })

    expect(createUser).not.toHaveBeenCalled()
  })

  it('should auto-create with authenticated=true once auth resolves as signed in', async () => {
    setupAuthLoading()
    jest.mocked(createUser).mockResolvedValueOnce({ userId: 'bright-heron', name: null, phone: null, textsSent: 0 })

    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <IdentityPhase onUserSelected={onUserSelected} sessionId="amber-harbor" users={[]} />
      </QueryClientProvider>,
    )
    expect(createUser).not.toHaveBeenCalled()

    setupSignedIn()
    rerender(
      <QueryClientProvider client={queryClient}>
        <IdentityPhase onUserSelected={onUserSelected} sessionId="amber-harbor" users={[]} />
      </QueryClientProvider>,
    )

    await waitFor(() => expect(createUser).toHaveBeenCalledWith('amber-harbor', true))
  })

  it('should show an error with a retry affordance when auto-create fails on an empty group', async () => {
    setup()
    jest.mocked(createUser).mockRejectedValueOnce(new Error('Network error'))

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users: [] })

    expect(await screen.findByText("Couldn't join. Try again.")).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })

  it('should retry auto-create when the retry button is pressed', async () => {
    setup()
    jest.mocked(createUser).mockRejectedValueOnce(new Error('Network error'))
    jest.mocked(createUser).mockResolvedValueOnce({ userId: 'bright-heron', name: null, phone: null, textsSent: 0 })

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users: [] })
    await screen.findByRole('button', { name: /try again/i })
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => expect(onUserSelected).toHaveBeenCalledWith('bright-heron'))
  })
})
