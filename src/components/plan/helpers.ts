import { PlanData } from '@types'

export type Phase = 'loading' | 'error' | 'identity' | 'active'

export function derivePhase(
  plan: PlanData | undefined,
  usersLoaded: boolean,
  userIdentified: boolean,
  isError: boolean,
): Phase {
  if (isError) return 'error'
  if (!plan) return 'loading'
  if (!usersLoaded) return 'loading'
  if (!userIdentified) return 'identity'
  return 'active'
}
