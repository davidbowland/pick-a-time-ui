import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ApiError } from 'aws-amplify/api'
import React from 'react'

import IdentityPhase, { IdentityPhaseProps } from './index'
import { useAuthContext } from '@components/auth-context'
import { createUser, fetchConfig, patchUser } from '@services/api'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

jest.mock('@components/auth-context')
jest.mock('@services/api', () => ({
  ...jest.requireActual('@services/api'),
  createUser: jest.fn(),
  patchUser: jest.fn(),
  fetchConfig: jest.fn(),
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
  const users = [{ userId: 'quiet-falcon', name: null, calendarStatus: 'not_connected' as const }]

  const config = {
    maxPollDates: 90,
    pollNameMaxLength: 100,
    participantNameMaxLength: 50,
    allowedSlotMinutes: [15, 30, 60, 90, 120],
    defaultSlotMinutes: 60,
    startEndMinuteStep: 15,
    maxPollDateRangeDays: 365,
    maxPollOverrideGroups: 10,
    maxUsersPerSession: 20,
    sessionExpireHours: 336,
  }

  beforeAll(() => {
    jest.mocked(fetchConfig).mockResolvedValue(config)
  })

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
      user: { name: 'Google User' },
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
    jest
      .mocked(createUser)
      .mockResolvedValueOnce({ userId: 'bright-heron', name: null, calendarStatus: 'not_connected' as const })

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
    jest
      .mocked(createUser)
      .mockResolvedValueOnce({ userId: 'bright-heron', name: null, calendarStatus: 'not_connected' as const })

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users: [] })

    await waitFor(() => expect(createUser).toHaveBeenCalledWith('amber-harbor', false))
    await waitFor(() => expect(onUserSelected).toHaveBeenCalledWith('bright-heron'))
  })

  it('should only call createUser once even across re-renders while the group is empty', async () => {
    setup()
    jest
      .mocked(createUser)
      .mockResolvedValue({ userId: 'bright-heron', name: null, calendarStatus: 'not_connected' as const })

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
    jest
      .mocked(createUser)
      .mockResolvedValueOnce({ userId: 'bright-heron', name: null, calendarStatus: 'not_connected' as const })

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
    jest
      .mocked(createUser)
      .mockResolvedValueOnce({ userId: 'bright-heron', name: null, calendarStatus: 'not_connected' as const })

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users: [] })
    await screen.findByRole('button', { name: /try again/i })
    await userEvent.click(screen.getByRole('button', { name: /try again/i }))

    await waitFor(() => expect(onUserSelected).toHaveBeenCalledWith('bright-heron'))
  })

  it('shows a "last used" tag next to the matching option', () => {
    setup()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users, lastUsedUserId: 'quiet-falcon' })

    expect(screen.getByText('· last used')).toBeInTheDocument()
  })

  it('does not show a "last used" tag when lastUsedUserId is not provided', () => {
    setup()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })

    expect(screen.queryByText('· last used')).not.toBeInTheDocument()
  })

  it('associates the radio group with the "Who are you on this poll?" heading', () => {
    setup()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users, lastUsedUserId: 'quiet-falcon' })

    expect(screen.getByRole('radiogroup', { name: 'Who are you on this poll?' })).toBeInTheDocument()
  })

  it('focuses the last-used radio option, not just the heading, when lastUsedUserId is set', () => {
    setup()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users, lastUsedUserId: 'quiet-falcon' })

    expect(screen.getByRole('radio', { name: /quiet falcon/i })).toHaveFocus()
  })

  it('falls back to focusing the heading when lastUsedUserId does not match any listed user', () => {
    setup()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users, lastUsedUserId: 'someone-else' })

    expect(screen.getByRole('heading', { name: 'Who are you on this poll?' })).toHaveFocus()
  })

  it('shows a name field only after selecting "Join as someone new" while signed out', async () => {
    setup()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))

    expect(await screen.findByLabelText('Name')).toBeInTheDocument()
  })

  it('never shows the name field when signed in', async () => {
    setupSignedIn()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })

    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))

    expect(screen.queryByLabelText('Name')).not.toBeInTheDocument()
  })

  it('creates the user without patching when the name field is left blank', async () => {
    setup()
    jest
      .mocked(createUser)
      .mockResolvedValueOnce({ userId: 'bright-heron', name: null, calendarStatus: 'not_connected' as const })

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })
    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() => expect(onUserSelected).toHaveBeenCalledWith('bright-heron'))
    expect(patchUser).not.toHaveBeenCalled()
  })

  it('creates the user then patches the trimmed name when one is entered', async () => {
    setup()
    jest
      .mocked(createUser)
      .mockResolvedValueOnce({ userId: 'bright-heron', name: null, calendarStatus: 'not_connected' as const })
    jest
      .mocked(patchUser)
      .mockResolvedValueOnce({ userId: 'bright-heron', name: 'Alex', calendarStatus: 'not_connected' as const })

    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })
    await userEvent.click(screen.getByRole('radio', { name: /join as someone new/i }))
    await userEvent.type(await screen.findByLabelText('Name'), '  Alex  ')
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }))

    await waitFor(() =>
      expect(patchUser).toHaveBeenCalledWith(
        'amber-harbor',
        'bright-heron',
        [{ op: 'replace', path: '/name', value: 'Alex' }],
        false,
      ),
    )
    expect(onUserSelected).toHaveBeenCalledWith('bright-heron')
  })

  it('explains that signing in keeps the name the same across devices', () => {
    setup()
    renderWithClient({ onUserSelected, sessionId: 'amber-harbor', users })

    expect(
      screen.getByText('Signing in keeps your name the same if you come back on another device.'),
    ).toBeInTheDocument()
  })
})
