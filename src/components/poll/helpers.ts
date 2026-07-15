import { PollData } from '@types'

export type Phase = 'loading' | 'error' | 'identity' | 'active'

export function derivePhase(
  poll: PollData | undefined,
  usersLoaded: boolean,
  userIdentified: boolean,
  isError: boolean,
): Phase {
  if (isError) return 'error'
  if (!poll) return 'loading'
  if (!usersLoaded) return 'loading'
  if (!userIdentified) return 'identity'
  return 'active'
}
