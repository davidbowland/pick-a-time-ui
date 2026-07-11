import { firstUnvotedIndex } from '@components/session/helpers'
import { SessionData, User } from '@types'

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
  ],
  byes: [null],
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

const baseUser: User = {
  userId: 'user-1',
  name: 'Test',
  phone: null,
  subscribedRounds: [],
  votes: [[null, null]],
  textsSent: 0,
}

describe('firstUnvotedIndex', () => {
  it('should return 0 when no votes cast', () => {
    expect(firstUnvotedIndex(baseSession, baseUser)).toBe(0)
  })

  it('should return 1 when first matchup voted', () => {
    const user = { ...baseUser, votes: [['a', null]] }
    expect(firstUnvotedIndex(baseSession, user)).toBe(1)
  })

  it('should return -1 when all matchups voted', () => {
    const user = { ...baseUser, votes: [['a', 'c']] }
    expect(firstUnvotedIndex(baseSession, user)).toBe(-1)
  })

  it('should return 0 when votes array is empty for round', () => {
    const user = { ...baseUser, votes: [] }
    expect(firstUnvotedIndex(baseSession, user)).toBe(0)
  })

  it('should return 0 when bracket round is undefined', () => {
    const session = { ...baseSession, currentRound: 5 }
    expect(firstUnvotedIndex(session, baseUser)).toBe(-1)
  })
})
