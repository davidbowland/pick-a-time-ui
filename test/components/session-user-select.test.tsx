import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// @ts-expect-error — mock-only export from __mocks__/index.tsx
import { mockSetAuthState } from '@components/auth-context'
import UserSelectPhase from '@components/session/user-select'
import * as api from '@services/api'
import { User } from '@types'

jest.mock('@components/auth-context')
jest.mock('@services/api', () => ({
  ...jest.requireActual('@services/api'),
  createUser: jest.fn(),
}))

const mockUsers: User[] = [
  { userId: 'brave-tiger', name: null, phone: null, subscribedRounds: [], votes: [[null]], textsSent: 0 },
  { userId: 'user-2', name: 'Alice', phone: null, subscribedRounds: [], votes: [[null]], textsSent: 0 },
]

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('UserSelectPhase', () => {
  const onUserSelected = jest.fn()

  beforeEach(() => {
    onUserSelected.mockClear()
  })

  it('should display user list with display names', () => {
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)
    expect(screen.getByText('brave tiger')).toBeInTheDocument()
    expect(screen.getByText('Alice')).toBeInTheDocument()
  })

  it("should show 'I'm new' option", () => {
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)
    expect(screen.getByText("I'm new")).toBeInTheDocument()
  })

  it('should call onUserSelected when selecting existing user and confirming', async () => {
    const user = userEvent.setup()
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)
    await user.click(screen.getByText('Alice'))
    await user.click(screen.getByText(/Let's go/i))
    expect(onUserSelected).toHaveBeenCalledWith('user-2')
  })

  it('should auto-create user when user list is empty', async () => {
    const newUser: User = {
      userId: 'new-user',
      name: null,
      phone: null,
      subscribedRounds: [],
      votes: [],
      textsSent: 0,
    }
    jest.mocked(api.createUser).mockResolvedValue(newUser)

    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={[]} />)

    await waitFor(() => {
      expect(api.createUser).toHaveBeenCalledWith('s1', false)
    })
    await waitFor(() => {
      expect(onUserSelected).toHaveBeenCalledWith('new-user')
    })
  })

  it('should only call createUser once even on re-render', async () => {
    const newUser: User = {
      userId: 'new-user',
      name: null,
      phone: null,
      subscribedRounds: [],
      votes: [],
      textsSent: 0,
    }
    jest.mocked(api.createUser).mockResolvedValue(newUser)

    const { rerender } = renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={[]} />)

    rerender(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })}
      >
        <UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={[]} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(api.createUser).toHaveBeenCalledTimes(1)
    })
  })

  it('should show error when create user returns 400', async () => {
    const { ApiError } = jest.requireActual('aws-amplify/api') as { ApiError: any }
    const error = new ApiError({ message: 'Bad Request', name: 'ApiError', recoverySuggestion: '' })
    Object.defineProperty(error, '_response', {
      value: { statusCode: 400, headers: {}, body: JSON.stringify({ message: 'Max players reached' }) },
    })
    jest.mocked(api.createUser).mockRejectedValue(error)

    const user = userEvent.setup()
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)

    await user.click(screen.getByText("I'm new"))
    await user.click(screen.getByText(/Let's go/i))

    expect(await screen.findByText(/Max players reached/i)).toBeInTheDocument()
  })

  it('should show invite section with copy link and QR code', () => {
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)
    expect(screen.getByText(/Invite someone/i)).toBeInTheDocument()
    expect(screen.getByText(/Copy invite link/i)).toBeInTheDocument()
  })

  it('should copy invite link to clipboard', async () => {
    const user = userEvent.setup()
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)
    const writeTextSpy = jest.spyOn(navigator.clipboard, 'writeText')
    await user.click(screen.getByText(/Copy invite link/i))
    expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining('/s/s1'))
    writeTextSpy.mockRestore()
  })

  it('should show Copied! after clicking copy', async () => {
    const user = userEvent.setup()
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)
    await user.click(screen.getByText(/Copy invite link/i))
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('should show generic error when createUser fails with non-400', async () => {
    jest.mocked(api.createUser).mockRejectedValue(new Error('Network error'))

    const user = userEvent.setup()
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)

    await user.click(screen.getByText("I'm new"))
    await user.click(screen.getByText(/Let's go/i))

    expect(await screen.findByText(/Couldn't join/i)).toBeInTheDocument()
  })

  it('should handle clipboard failure gracefully', async () => {
    const user = userEvent.setup()
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)
    jest.spyOn(navigator.clipboard, 'writeText').mockRejectedValueOnce(new Error('Permission denied'))
    await user.click(screen.getByText(/Copy invite link/i))
    // Should not crash
    expect(screen.getByText(/Invite someone/i)).toBeInTheDocument()
  })

  it('should not auto-create user while auth is still loading', () => {
    mockSetAuthState({ isSignedIn: false, isLoading: true })
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={[]} />)
    expect(api.createUser).not.toHaveBeenCalled()
  })

  it('should not create user on manual confirm while auth is still loading', async () => {
    mockSetAuthState({ isSignedIn: false, isLoading: true })
    const user = userEvent.setup()
    renderWithClient(<UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={mockUsers} />)

    await user.click(screen.getByText("I'm new"))
    await user.click(screen.getByRole('button', { name: /Joining/i }))

    expect(api.createUser).not.toHaveBeenCalled()
  })

  it('should auto-create with authenticated=true once auth finishes loading', async () => {
    const newUser: User = {
      userId: 'new-user',
      name: 'Google User',
      phone: null,
      subscribedRounds: [],
      votes: [],
      textsSent: 0,
    }
    jest.mocked(api.createUser).mockResolvedValue(newUser)

    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
    })

    // Start with auth loading
    mockSetAuthState({ isSignedIn: false, isLoading: true })
    const { rerender } = render(
      <QueryClientProvider client={queryClient}>
        <UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={[]} />
      </QueryClientProvider>,
    )
    expect(api.createUser).not.toHaveBeenCalled()

    // Auth finishes — user is signed in
    mockSetAuthState({ isSignedIn: true, isLoading: false })
    rerender(
      <QueryClientProvider client={queryClient}>
        <UserSelectPhase onUserSelected={onUserSelected} sessionId="s1" users={[]} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(api.createUser).toHaveBeenCalledWith('s1', true)
    })
  })
})
