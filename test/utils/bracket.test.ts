import { SessionData } from '@types'
import { getRoundWinners } from '@utils/bracket'

const baseSession: SessionData = {
  sessionId: 'test',
  address: '123 Main St',
  location: { latitude: 0, longitude: 0 },
  currentRound: 1,
  totalRounds: 3,
  bracket: [
    [
      ['a', 'b'],
      ['c', 'd'],
      ['e', 'f'],
    ],
    [
      ['a', 'c'],
      ['e', 'g'],
    ],
    [['a', 'e']],
  ],
  byes: [null, 'g', null],
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

describe('getRoundWinners', () => {
  it('returns winners that appear in next round matchups', () => {
    const winners = getRoundWinners(baseSession, 0)
    expect(winners[0]).toBe('a')
    expect(winners[1]).toBe('c')
  })

  it('returns winner whose only presence in the next round is as a bye', () => {
    // g won round 0 matchup [e, g] but does NOT appear in any round 1 matchup —
    // it only appears as byes[1]. This is the exact bug scenario.
    const session: SessionData = {
      ...baseSession,
      bracket: [
        [
          ['a', 'b'],
          ['c', 'd'],
          ['e', 'g'],
        ],
        [['a', 'c']],
        [['a', 'g']],
      ],
      byes: [null, 'g', null],
    }
    const winners = getRoundWinners(session, 0)
    expect(winners[2]).toBe('g')
  })

  it('returns null for every matchup in an incomplete round', () => {
    const winners = getRoundWinners(baseSession, 1)
    expect(winners[0]).toBe(null)
    expect(winners[1]).toBe(null)
  })

  it('returns session.winner for the final round', () => {
    const session = { ...baseSession, currentRound: 3, winner: 'a' }
    const winners = getRoundWinners(session, 2)
    expect(winners[0]).toBe('a')
  })

  it('returns null for final round matchup when winner is not a participant', () => {
    const session = { ...baseSession, currentRound: 3, winner: 'z' }
    const winners = getRoundWinners(session, 2)
    expect(winners[0]).toBe(null)
  })

  it('returns null when round is not yet completed and not final', () => {
    const session = { ...baseSession, currentRound: 0 }
    const winners = getRoundWinners(session, 0)
    expect(winners[0]).toBe(null)
    expect(winners[1]).toBe(null)
    expect(winners[2]).toBe(null)
  })

  it('returns null when bye would be the only signal but byes array is too short', () => {
    // h won round 0 matchup [f, h]. h does NOT appear in any round 1 matchup,
    // and byes is empty so byes[1] is undefined. Winner should be null.
    const session: SessionData = {
      ...baseSession,
      bracket: [
        [
          ['a', 'b'],
          ['c', 'd'],
          ['f', 'h'],
        ],
        [['a', 'c']],
        [['a', 'h']],
      ],
      byes: [],
    }
    const winners = getRoundWinners(session, 0)
    expect(winners[0]).toBe('a')
    expect(winners[1]).toBe('c')
    // h only appears in round 2, not round 1 matchups or byes — can't be detected
    expect(winners[2]).toBe(null)
  })
})
