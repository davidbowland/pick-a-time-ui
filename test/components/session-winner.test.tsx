import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import WinnerPhase from '@components/session/winner'
import { ChoicesMap, SessionData } from '@types'

const mockPush = jest.fn()
jest.mock('next/router', () => ({
  useRouter: () => ({ push: mockPush }),
}))

// Mock BracketView to verify open/close
jest.mock('@components/bracket-view', () => ({
  __esModule: true,
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) =>
    open ? (
      <div data-testid="bracket-view">
        <button onClick={onClose}>Close bracket</button>
      </div>
    ) : null,
}))

const mockSession: SessionData = {
  sessionId: 'test-session',
  address: '123 Main St',
  location: { latitude: 0, longitude: 0 },
  currentRound: 1,
  totalRounds: 2,
  bracket: [[['a', 'b']], [['a', 'c']]],
  byes: [null, null],
  isReady: true,
  errorMessage: null,
  filterClosingSoon: false,
  users: ['user-1'],
  winner: 'a',
  type: ['restaurant'],
  exclude: [],
  radius: 5000,
  rankBy: 'DISTANCE',
  voterCount: 2,
  votersSubmitted: 0,
}

const mockChoices: ChoicesMap = {
  a: { choiceId: 'a', name: 'Winner Restaurant', photos: [], rating: 4.5, ratingsTotal: 100 },
  b: { choiceId: 'b', name: 'Restaurant B', photos: [] },
  c: { choiceId: 'c', name: 'Restaurant C', photos: [] },
}

describe('WinnerPhase', () => {
  beforeEach(() => {
    mockPush.mockClear()
  })

  it('should display the winning restaurant name', () => {
    render(<WinnerPhase choices={mockChoices} session={mockSession} />)
    expect(screen.getByText('Winner Restaurant')).toBeInTheDocument()
  })

  it('should display Winner title', () => {
    render(<WinnerPhase choices={mockChoices} session={mockSession} />)
    expect(screen.getByText('WINNER')).toBeInTheDocument()
  })

  it('should display Start over button linking to /', async () => {
    const user = userEvent.setup()
    render(<WinnerPhase choices={mockChoices} session={mockSession} />)
    await user.click(screen.getByText(/Start over/i))
    expect(mockPush).toHaveBeenCalledWith('/')
  })

  it('should open bracket view when View final bracket is clicked', async () => {
    const user = userEvent.setup()
    render(<WinnerPhase choices={mockChoices} session={mockSession} />)
    await user.click(screen.getByText(/View final bracket/i))
    expect(screen.getByTestId('bracket-view')).toBeInTheDocument()
  })

  it('should close bracket view', async () => {
    const user = userEvent.setup()
    render(<WinnerPhase choices={mockChoices} session={mockSession} />)
    await user.click(screen.getByText(/View final bracket/i))
    await user.click(screen.getByText('Close bracket'))
    expect(screen.queryByTestId('bracket-view')).not.toBeInTheDocument()
  })

  it('should render loading spinner when winner choice is not in choices map', () => {
    render(<WinnerPhase choices={{}} session={mockSession} />)
    expect(screen.getByText(/Revealing the winner/i)).toBeInTheDocument()
  })

  it('should render loading when session.winner is null', () => {
    const noWinnerSession = { ...mockSession, winner: null }
    render(<WinnerPhase choices={mockChoices} session={noWinnerSession} />)
    expect(screen.getByText(/Revealing the winner/i)).toBeInTheDocument()
  })

  it('should show filter badge when filterClosingSoon is true', () => {
    render(<WinnerPhase choices={mockChoices} session={{ ...mockSession, filterClosingSoon: true }} />)
    expect(screen.getByText(/Closing soon hidden/i)).toBeInTheDocument()
  })

  it('should not show filter badge when filterClosingSoon is false', () => {
    render(<WinnerPhase choices={mockChoices} session={mockSession} />)
    expect(screen.queryByText(/Closing soon hidden/i)).not.toBeInTheDocument()
  })
})
