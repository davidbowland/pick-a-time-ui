import { SessionData } from '@types'

/**
 * Collect every choice ID that appears in the next round — both as a matchup
 * participant and as the bye recipient.
 *
 * NOTE: This is a superset lookup, not a positional proof. A choice appearing
 * in this set means it exists somewhere in round N+1, which in practice means
 * it won its matchup in round N (the server enforces this invariant). If the
 * server ever placed a non-winner into the next round, this would give a false
 * positive. A strict positional mapping would require backend changes.
 */
function advancedIds(session: SessionData, roundIndex: number): Set<string> {
  const ids = new Set<string>()

  const nextRound = session.bracket[roundIndex + 1]
  if (nextRound) {
    for (const matchup of nextRound) {
      ids.add(matchup[0])
      ids.add(matchup[1])
    }
  }

  const nextBye = session.byes[roundIndex + 1]
  if (nextBye) {
    ids.add(nextBye)
  }

  return ids
}

/**
 * Build an array of winner IDs for every matchup in a given round.
 *
 * Returns an array where index i is the winning choice ID for matchup i,
 * or null if the winner is not yet known.
 * Compute this once per round and reuse across all matchups.
 */
export function getRoundWinners(session: SessionData, roundIndex: number): (string | null)[] {
  const matchups = session.bracket[roundIndex] ?? []
  const isFinalRound = session.winner !== null && roundIndex === session.bracket.length - 1
  const isCompletedRound = roundIndex < session.currentRound

  if (!isFinalRound && !isCompletedRound) {
    return matchups.map(() => null)
  }

  const advanced = isFinalRound ? null : advancedIds(session, roundIndex)

  return matchups.map(([choiceA, choiceB]) => {
    if (isFinalRound && session.winner) {
      if (session.winner === choiceA || session.winner === choiceB) {
        return session.winner
      }
      return null
    }

    if (advanced) {
      if (advanced.has(choiceA)) return choiceA
      if (advanced.has(choiceB)) return choiceB
    }

    return null
  })
}
