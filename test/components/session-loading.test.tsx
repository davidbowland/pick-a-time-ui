import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import React from 'react'

import LoadingPhase from '@components/session/loading'
import { SessionData } from '@types'

const baseSession: SessionData = {
  sessionId: 'test-session',
  address: '123 Main St',
  location: { latitude: 0, longitude: 0 },
  currentRound: 0,
  totalRounds: 3,
  bracket: [[['a', 'b']]],
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

describe('LoadingPhase', () => {
  beforeAll(() => {
    Math.random = jest.fn(() => 0.5)
  })

  it('should render spinner and loading text when no error or timeout', () => {
    render(<LoadingPhase session={baseSession} />)
    expect(screen.getByText(/Scouting the competition/i)).toBeInTheDocument()
  })

  it('should cycle to a different loading message', () => {
    jest.useFakeTimers()
    render(<LoadingPhase session={baseSession} />)
    expect(screen.getByText(/Scouting the competition/i)).toBeInTheDocument()

    act(() => {
      jest.advanceTimersByTime(2200)
    })
    expect(screen.getByText(/Sharpening the knives/i)).toBeInTheDocument()

    jest.useRealTimers()
  })

  it('should render spinner when session is undefined', () => {
    render(<LoadingPhase />)
    expect(screen.getByText(/Scouting the competition/i)).toBeInTheDocument()
  })

  it('should render error message with link home when errorMessage is set', () => {
    render(<LoadingPhase session={{ ...baseSession, errorMessage: 'Server exploded' }} />)
    expect(screen.getByText(/Server exploded/i)).toBeInTheDocument()
    expect(screen.getByText(/Go home/i)).toHaveAttribute('href', '/')
  })

  it('should render timeout message when timeoutAt is in the past', () => {
    render(<LoadingPhase session={{ ...baseSession, timeoutAt: Date.now() - 1000 }} />)
    expect(screen.getByText(/Session setup timed out/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Try again/i })
    expect(link).toHaveAttribute('href', '/')
  })

  it('should render spinner when timeoutAt is in the future', () => {
    render(<LoadingPhase session={{ ...baseSession, timeoutAt: Date.now() + 60000 }} />)
    expect(screen.getByText(/Scouting the competition/i)).toBeInTheDocument()
  })
})
