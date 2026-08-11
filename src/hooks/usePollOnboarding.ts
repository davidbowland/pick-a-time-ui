import { useState } from 'react'

import { defaultStorage, readSeenIntro, writeSeenIntro } from './useRecentPolls'

export interface PollOnboarding {
  showIntro: boolean
  dismissIntro: () => void
}

/**
 * Whether this poll's one-time introduction should show. The flag is a field on the poll's
 * `pat_recent_polls` entry (ADR-4), so it expires with the poll itself instead of accumulating in
 * a `pat_onboarded_{sessionId}` key that nothing ever removed.
 *
 * Pass `seed` so dismissal can persist before identity resolves. The introduction renders during
 * the identity phase and the recents entry is written when that phase ends, so without a seed the
 * two never coexist and the dismissal is lost — someone who dismissed it, was pulled away before
 * picking a name, and returned to the same link would meet it again.
 */
export function usePollOnboarding(
  sessionId: string,
  storage: Storage | undefined = defaultStorage(),
  now: () => number = Date.now,
  seed?: { expiration: number; pollName: string },
): PollOnboarding {
  const [showIntro, setShowIntro] = useState(() => !readSeenIntro(sessionId, storage, now))

  const dismissIntro = (): void => {
    writeSeenIntro(sessionId, true, storage, now, seed)
    setShowIntro(false)
  }

  return { showIntro, dismissIntro }
}
