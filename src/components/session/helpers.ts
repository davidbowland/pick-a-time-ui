import { SessionData, User } from '@types'

/**
 * Find the index of the first unvoted matchup for a user in the current round.
 * Returns -1 when every matchup has a vote.
 *
 * votes may be shorter than matchups (e.g. a fresh user with an empty votes
 * array), so we iterate over matchup indices rather than vote entries.
 */
export function firstUnvotedIndex(session: SessionData, user: User): number {
  const round = session.currentRound
  const matchups = session.bracket[round] ?? []
  const votes = user.votes[round] ?? []
  for (let i = 0; i < matchups.length; i++) {
    if (votes[i] == null) return i
  }
  return -1
}
