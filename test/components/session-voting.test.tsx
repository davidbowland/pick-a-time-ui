// Grab reference after mock is set up
import { toast } from '@heroui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import VotingPhase from '@components/session/voting'
import * as api from '@services/api'
import { ChoicesMap, SessionData, User } from '@types'

jest.mock('@components/auth-context')
jest.mock('@services/api')

jest.mock('@heroui/react', () => ({
  ...jest.requireActual('@heroui/react'),
  toast: Object.assign(jest.fn(), { danger: jest.fn(), info: jest.fn(), success: jest.fn(), warning: jest.fn() }),
}))

// RestaurantCard wraps a div with role="button" and custom keyboard handling;
// mocking it as a plain button keeps voting logic tests focused and deterministic
jest.mock('@components/restaurant-card', () => ({
  __esModule: true,
  default: ({ choice, onClick }: { choice: { name: string }; onClick?: () => void }) => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    const R = require('react')
    return R.createElement('button', { 'data-testid': `card-${choice.name}`, onClick, type: 'button' }, choice.name)
  },
}))

const mockSession: SessionData = {
  sessionId: 'test-session',
  address: '123 Main St',
  location: { latitude: 0, longitude: 0 },
  currentRound: 0,
  totalRounds: 3,
  bracket: [
    [
      ['a', 'b'],
      ['c', 'd'],
    ],
  ],
  byes: [null],
  isReady: true,
  errorMessage: null,
  filterClosingSoon: false,
  users: ['user-1'],
  winner: null,
  type: ['restaurant'],
  exclude: [],
  radius: 5000,
  rankBy: 'DISTANCE',
  voterCount: 2,
  votersSubmitted: 0,
}

const mockUser: User = {
  userId: 'user-1',
  name: 'Test User',
  phone: null,
  subscribedRounds: [],
  votes: [[null, null]],
  textsSent: 0,
}

const mockChoices: ChoicesMap = {
  a: { choiceId: 'a', name: 'Restaurant A', photos: [] },
  b: { choiceId: 'b', name: 'Restaurant B', photos: [] },
  c: { choiceId: 'c', name: 'Restaurant C', photos: [] },
  d: { choiceId: 'd', name: 'Restaurant D', photos: [] },
}

let queryClient: QueryClient

function renderWithClient(ui: React.ReactElement) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  // Seed users data so optimistic updates can map over them
  const otherUser = { ...mockUser, userId: 'user-2', name: 'Other User' }
  queryClient.setQueryData(['users', 'test-session'], [mockUser, otherUser])
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('VotingPhase', () => {
  beforeEach(() => {
    jest.mocked(api.patchUser).mockResolvedValue(mockUser)
    jest.mocked(toast.danger).mockClear()
    jest.mocked(toast.info).mockClear()
  })

  it('should display the current matchup restaurants', () => {
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(screen.getByTestId('card-Restaurant A')).toBeInTheDocument()
    expect(screen.getByTestId('card-Restaurant B')).toBeInTheDocument()
  })

  const brandText = (label: string): string =>
    screen.getByText(label).closest('div')?.querySelector('.choosee-brand')?.textContent?.replace(/\s+/g, ' ').trim() ??
    ''

  it('should display round indicator', () => {
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(brandText('Round')).toBe('1 / 3')
  })

  it('should display matchup progress', () => {
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(brandText('Match')).toBe('1 / 2')
  })

  it('should display user name with edit icon', () => {
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(screen.getAllByText('Test User')[0]).toBeInTheDocument()
  })

  it('should display userId-derived name when user.name is null', () => {
    const noNameUser = { ...mockUser, name: null, userId: 'brave-tiger' }
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={noNameUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(screen.getAllByText('brave tiger')[0]).toBeInTheDocument()
  })

  it('should resume at first unvoted matchup', () => {
    const partialUser = { ...mockUser, votes: [['a', null]] }
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={partialUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(screen.getByTestId('card-Restaurant C')).toBeInTheDocument()
    expect(screen.getByTestId('card-Restaurant D')).toBeInTheDocument()
    expect(
      screen
        .getByText('Match')
        .closest('div')
        ?.querySelector('.choosee-brand')
        ?.textContent?.replace(/\s+/g, ' ')
        .trim(),
    ).toBe('2 / 2')
  })

  it('should render nothing when all matchups are voted', () => {
    const allVotedUser = { ...mockUser, votes: [['a', 'c']] }
    const { container } = renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={allVotedUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('should display View bracket button', () => {
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(screen.getByText(/View bracket/i)).toBeInTheDocument()
  })

  it('should call patchUser with vote when a card is clicked', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    await user.click(screen.getByTestId('card-Restaurant A'))

    await waitFor(() => {
      expect(api.patchUser).toHaveBeenCalledWith(
        'test-session',
        'user-1',
        [{ op: 'replace', path: '/votes/0/0', value: 'a' }],
        false,
      )
    })
  })

  it('should invalidate session query on ROUND_NOT_CURRENT error', async () => {
    jest.mocked(api.hasErrorCode).mockReturnValueOnce(true)
    jest.mocked(api.patchUser).mockRejectedValueOnce(new Error('round conflict'))

    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    const spy = jest.spyOn(queryClient, 'invalidateQueries')

    await user.click(screen.getByTestId('card-Restaurant A'))

    await waitFor(() => {
      expect(spy).toHaveBeenCalledWith({ queryKey: ['session', 'test-session'] })
    })

    spy.mockRestore()
  })

  it('should show info toast on ROUND_NOT_CURRENT error', async () => {
    jest.mocked(api.hasErrorCode).mockReturnValueOnce(true)
    jest.mocked(api.patchUser).mockRejectedValueOnce(new Error('round conflict'))

    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )

    await user.click(screen.getByTestId('card-Restaurant A'))

    await waitFor(() => {
      expect(toast.info).toHaveBeenCalledWith('Round was advanced, moving to the next round.')
    })
  })

  it('should show toast on non-409 vote failure', async () => {
    jest.mocked(api.patchUser).mockRejectedValueOnce(new Error('Network error'))

    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    await user.click(screen.getByTestId('card-Restaurant A'))

    await waitFor(() => {
      expect(toast.danger).toHaveBeenCalledWith('Vote failed. Please try again.')
    })
  })

  it('should allow inline name editing', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    await user.click(screen.getAllByText('Test User')[0])

    const input = screen.getByDisplayValue('Test User')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(api.patchUser).toHaveBeenCalledWith(
        'test-session',
        'user-1',
        [{ op: 'replace', path: '/name', value: 'New Name' }],
        false,
      )
    })
  })

  it('should reset name on Escape during editing', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    await user.click(screen.getAllByText('Test User')[0])

    const input = screen.getByDisplayValue('Test User')
    await user.clear(input)
    await user.type(input, 'garbage')
    await user.keyboard('{Escape}')

    expect(screen.getAllByText('Test User')[0]).toBeInTheDocument()
    expect(screen.queryByDisplayValue('garbage')).not.toBeInTheDocument()
  })

  it('should reset value on empty commit during name editing', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    await user.click(screen.getAllByText('Test User')[0])

    const input = screen.getByDisplayValue('Test User')
    await user.clear(input)
    await user.type(input, '   ')
    await user.tab()

    expect(screen.getAllByText('Test User')[0]).toBeInTheDocument()
    expect(api.patchUser).not.toHaveBeenCalled()
  })

  it('should show toast on name mutation failure', async () => {
    jest.mocked(api.patchUser).mockRejectedValueOnce(new Error('Network error'))

    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    await user.click(screen.getAllByText('Test User')[0])

    const input = screen.getByDisplayValue('Test User')
    await user.clear(input)
    await user.type(input, 'New Name')
    await user.keyboard('{Enter}')

    await waitFor(() => {
      expect(toast.danger).toHaveBeenCalledWith('Failed to update name. Please try again.')
    })
  })

  it('should not save name when it matches current name', async () => {
    const user = userEvent.setup()
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    await user.click(screen.getAllByText('Test User')[0])

    // Just press Enter without changing
    await user.keyboard('{Enter}')

    expect(api.patchUser).not.toHaveBeenCalled()
  })

  it('should render first matchup when votes array is empty (fresh user)', () => {
    const freshUser = { ...mockUser, votes: [[]] }
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={freshUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(screen.getByTestId('card-Restaurant A')).toBeInTheDocument()
    expect(screen.getByTestId('card-Restaurant B')).toBeInTheDocument()
  })

  it('should use fallback choice when choice is not in choices map', () => {
    const sparseChoices = { a: mockChoices.a }
    renderWithClient(
      <VotingPhase
        choices={sparseChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    // choiceB 'b' is not in sparseChoices, so fallback name should be 'b'
    expect(screen.getByTestId('card-Restaurant A')).toBeInTheDocument()
    expect(screen.getByTestId('card-b')).toBeInTheDocument()
  })

  it('should show solo voter hint when usersCount <= 1 and on first round', () => {
    const soloSession = { ...mockSession, voterCount: 1 }
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={soloSession}
        sessionId="test-session"
        usersCount={1}
      />,
    )
    expect(screen.getByText(/You're the only one here/i)).toBeInTheDocument()
  })

  it('should not show solo voter hint when usersCount > 1', () => {
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={mockUser}
        session={mockSession}
        sessionId="test-session"
        usersCount={2}
      />,
    )
    expect(screen.queryByText(/You're the only one here/i)).not.toBeInTheDocument()
  })

  it('should not show solo voter hint after first round', () => {
    const laterRound: SessionData = {
      ...mockSession,
      voterCount: 1,
      currentRound: 1,
      bracket: [mockSession.bracket[0], [['a', 'c'] as [string, string]]],
    }
    const laterUser = { ...mockUser, votes: [['a', 'c'], [null]] }
    renderWithClient(
      <VotingPhase
        choices={mockChoices}
        currentUser={laterUser}
        session={laterRound}
        sessionId="test-session"
        usersCount={1}
      />,
    )
    expect(screen.queryByText(/You're the only one here/i)).not.toBeInTheDocument()
  })
})
