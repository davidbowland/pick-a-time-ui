import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import '@testing-library/jest-dom'
import { act, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import SessionWithErrorBoundary from './index'
import * as api from '@services/api'
import { ChoicesMap, SessionData, User } from '@types'

jest.mock('@services/api')
jest.mock('@components/auth-context')
jest.mock('next/router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

const mockSession: SessionData = {
  sessionId: 'test-session',
  address: '123 Main St',
  location: { latitude: 0, longitude: 0 },
  currentRound: 0,
  totalRounds: 3,
  bracket: [[['choice-a', 'choice-b']]],
  byes: [null],
  isReady: false,
  errorMessage: null,
  filterClosingSoon: false,
  users: [],
  winner: null,
  type: ['restaurant'],
  exclude: [],
  radius: 5000,
  rankBy: 'DISTANCE',
  voterCount: 2,
  votersSubmitted: 0,
}

const mockUsers: User[] = [
  {
    userId: 'user-1',
    name: 'Test User',
    phone: null,
    subscribedRounds: [],
    votes: [[null]],
    textsSent: 0,
  },
]

const mockChoices: ChoicesMap = {
  'choice-a': {
    choiceId: 'choice-a',
    name: 'Restaurant A',
    photos: [],
  },
  'choice-b': {
    choiceId: 'choice-b',
    name: 'Restaurant B',
    photos: [],
  },
}

let queryClient: QueryClient

function renderWithClient(ui: React.ReactElement) {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('Session phase router', () => {
  const originalLocation = window.location
  const replaceStateSpy = jest.spyOn(window.history, 'replaceState')
  const originalRandom = Math.random

  afterEach(async () => {
    await queryClient?.cancelQueries()
    queryClient?.clear()
  })

  beforeAll(() => {
    Math.random = jest.fn(() => 0.5)
  })

  beforeEach(() => {
    jest.mocked(api.fetchSession).mockResolvedValue(mockSession)
    jest.mocked(api.fetchUsers).mockResolvedValue(mockUsers)
    jest.mocked(api.fetchChoices).mockResolvedValue(mockChoices)
    replaceStateSpy.mockClear()

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname: '/s/test-session', search: '' },
    })
  })

  afterAll(() => {
    Math.random = originalRandom
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
    replaceStateSpy.mockRestore()
  })

  it('should render loading phase when session is not ready', async () => {
    jest.mocked(api.fetchSession).mockResolvedValue({ ...mockSession, isReady: false, errorMessage: null })
    renderWithClient(<SessionWithErrorBoundary sessionId="test-session" />)

    expect(await screen.findByText(/Scouting the competition/i)).toBeInTheDocument()
  })

  it('should render error when session has errorMessage', async () => {
    jest.mocked(api.fetchSession).mockResolvedValue({
      ...mockSession,
      isReady: false,
      errorMessage: 'Something went wrong on the server',
    })
    renderWithClient(<SessionWithErrorBoundary sessionId="test-session" />)

    expect(await screen.findByText(/Something went wrong on the server/i)).toBeInTheDocument()
  })

  it('should render winner phase when winner is set', async () => {
    jest.mocked(api.fetchSession).mockResolvedValue({
      ...mockSession,
      isReady: true,
      winner: 'choice-a',
    })
    renderWithClient(<SessionWithErrorBoundary sessionId="test-session" />)

    expect(await screen.findByText(/Restaurant A/i)).toBeInTheDocument()
    expect(screen.getByText(/Winner/i)).toBeInTheDocument()
  })

  it('should render user select phase when no user is identified', async () => {
    jest.mocked(api.fetchSession).mockResolvedValue({ ...mockSession, isReady: true })
    jest
      .mocked(api.fetchUsers)
      .mockResolvedValue([
        { userId: 'user-1', name: 'Test User', phone: null, subscribedRounds: [], votes: [[null]], textsSent: 0 },
      ])
    renderWithClient(<SessionWithErrorBoundary sessionId="test-session" />)

    expect(await screen.findByText(/Welcome back/i)).toBeInTheDocument()
  })

  it('should render loading phase while users are still fetching', async () => {
    let resolveUsers: (value: User[]) => void
    const pendingUsers = new Promise<User[]>((resolve) => {
      resolveUsers = resolve
    })
    jest.mocked(api.fetchSession).mockResolvedValue({ ...mockSession, isReady: true })
    jest.mocked(api.fetchUsers).mockReturnValue(pendingUsers)
    renderWithClient(<SessionWithErrorBoundary sessionId="test-session" />)

    expect(await screen.findByText(/Scouting the competition/i)).toBeInTheDocument()

    // Resolve so react-query cleans up
    await act(async () => {
      resolveUsers!(mockUsers)
    })
  })

  it('should read ?id= from URL and strip it via replaceState', async () => {
    window.location.search = '?id=user-1'
    jest.mocked(api.fetchSession).mockResolvedValue({ ...mockSession, isReady: true })
    jest.mocked(api.fetchUsers).mockResolvedValue(mockUsers)
    renderWithClient(<SessionWithErrorBoundary sessionId="test-session" />)

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/s/test-session')
    })
  })

  it('should preserve other query params when stripping ?id=', async () => {
    window.location.search = '?id=user-1&ref=share'
    jest.mocked(api.fetchSession).mockResolvedValue({ ...mockSession, isReady: true })
    jest.mocked(api.fetchUsers).mockResolvedValue(mockUsers)
    renderWithClient(<SessionWithErrorBoundary sessionId="test-session" />)

    await waitFor(() => {
      expect(replaceStateSpy).toHaveBeenCalledWith(null, '', '/s/test-session?ref=share')
    })
  })
})
