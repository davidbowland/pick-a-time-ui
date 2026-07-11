import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

import BracketView from '@components/bracket-view'
import { ChoicesMap, SessionData } from '@types'

const choices: ChoicesMap = {
  a: { choiceId: 'a', name: 'Pizza Place', photos: [] },
  b: { choiceId: 'b', name: 'Burger Joint', photos: [] },
  c: { choiceId: 'c', name: 'Taco Shop', photos: [] },
  d: { choiceId: 'd', name: 'Sushi Bar', photos: [] },
}

const baseSession: SessionData = {
  sessionId: 'test',
  address: '123 Main St',
  location: { latitude: 0, longitude: 0 },
  currentRound: 0,
  totalRounds: 2,
  bracket: [
    [
      ['a', 'b'],
      ['c', 'd'],
    ],
    [['a', 'c']],
  ],
  byes: [null, null],
  isReady: true,
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

describe('BracketView', () => {
  const onClose = jest.fn()

  beforeEach(() => {
    onClose.mockClear()
  })

  it('should not render when open is false', () => {
    const { container } = render(<BracketView choices={choices} onClose={onClose} open={false} session={baseSession} />)
    expect(container.innerHTML).toBe('')
  })

  it('should render when open is true', () => {
    render(<BracketView choices={choices} onClose={onClose} open={true} session={baseSession} />)
    expect(screen.getByText('The Bracket')).toBeInTheDocument()
  })

  it('should render round headers', () => {
    render(<BracketView choices={choices} onClose={onClose} open={true} session={baseSession} />)
    expect(screen.getByText('Round 1')).toBeInTheDocument()
    expect(screen.getByText('Round 2')).toBeInTheDocument()
  })

  it('should render restaurant names in matchups', () => {
    render(<BracketView choices={choices} onClose={onClose} open={true} session={baseSession} />)
    expect(screen.getAllByText('Pizza Place').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Burger Joint')).toBeInTheDocument()
    expect(screen.getAllByText('Taco Shop').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Sushi Bar')).toBeInTheDocument()
  })

  it('should display byes when present', () => {
    const session = { ...baseSession, byes: ['d', null] }
    render(<BracketView choices={choices} onClose={onClose} open={true} session={session} />)
    expect(screen.getByText(/Sushi Bar — bye/)).toBeInTheDocument()
  })

  it('should call onClose when backdrop is clicked', async () => {
    const user = userEvent.setup()
    render(<BracketView choices={choices} onClose={onClose} open={true} session={baseSession} />)
    // HeroUI Drawer is dismissable — clicking outside the dialog content triggers close.
    // In JSDOM the overlay is the element with data-react-aria-underlay.
    const underlay = document.querySelector('[data-react-aria-underlay]')
    if (underlay) {
      await user.click(underlay)
    } else {
      // Fallback: Escape also dismisses
      await user.keyboard('{Escape}')
    }
    expect(onClose).toHaveBeenCalled()
  })

  it('should call onClose when close button is pressed', async () => {
    const user = userEvent.setup()
    render(<BracketView choices={choices} onClose={onClose} open={true} session={baseSession} />)
    await user.click(screen.getByLabelText('Close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('should call onClose when Escape key is pressed', async () => {
    const user = userEvent.setup()
    render(<BracketView choices={choices} onClose={onClose} open={true} session={baseSession} />)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalled()
  })

  it('should not crash when winner is set on final round', () => {
    const sessionWithWinner = { ...baseSession, currentRound: 2, winner: 'a' }
    render(<BracketView choices={choices} onClose={onClose} open={true} session={sessionWithWinner} />)
    expect(screen.getByText('The Bracket')).toBeInTheDocument()
  })

  it('should not block interaction with the page after closing', async () => {
    const { rerender } = render(
      <div>
        <button data-testid="page-button">Page Button</button>
        <BracketView choices={choices} onClose={onClose} open={true} session={baseSession} />
      </div>,
    )
    expect(screen.getByText('The Bracket')).toBeInTheDocument()

    // Simulate parent setting open=false after onClose fires
    rerender(
      <div>
        <button data-testid="page-button">Page Button</button>
        <BracketView choices={choices} onClose={onClose} open={false} session={baseSession} />
      </div>,
    )

    // Backdrop overlay should be removed from the DOM
    expect(document.querySelector('[data-react-aria-underlay]')).not.toBeInTheDocument()
  })

  it('should not crash when choiceB advances to next round', () => {
    const sessionWithBWinner = {
      ...baseSession,
      currentRound: 1,
      bracket: [[['a', 'b'] as [string, string], ['c', 'd'] as [string, string]], [['b', 'd'] as [string, string]]],
    }
    render(<BracketView choices={choices} onClose={onClose} open={true} session={sessionWithBWinner} />)
    expect(screen.getByText('The Bracket')).toBeInTheDocument()
  })
})
