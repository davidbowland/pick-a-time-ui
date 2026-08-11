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
 * Dismissal only persists once the poll has a recents entry, which is written when identity
 * resolves. Before that, the dismissal holds for the session but is not stored — writing an
 * onboarding record with no expiration is precisely the defect this change removes.
 */
export function usePollOnboarding(
  sessionId: string,
  storage: Storage | undefined = defaultStorage(),
  now: () => number = Date.now,
): PollOnboarding {
  const [showIntro, setShowIntro] = useState(() => !readSeenIntro(sessionId, storage, now))

  const dismissIntro = (): void => {
    writeSeenIntro(sessionId, true, storage, now)
    setShowIntro(false)
  }

  return { showIntro, dismissIntro }
}
