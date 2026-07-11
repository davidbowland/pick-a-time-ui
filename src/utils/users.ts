import { SessionData, User } from '@types'

export function displayName(user: User): string {
  return user.name || user.userId.replace(/[^a-z]+/gi, ' ').trim()
}

export function isSoloVoter(session: SessionData): boolean {
  return session.voterCount <= 1 && session.currentRound === 0
}
