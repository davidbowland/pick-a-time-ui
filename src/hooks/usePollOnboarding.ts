import { useState } from 'react'

function storageKey(sessionId: string): string {
  return `pat_onboarded_${sessionId.replace(/[^a-zA-Z0-9]/g, '_')}`
}

export interface PollOnboarding {
  showIntro: boolean
  dismissIntro: () => void
  isGuideOpen: boolean
  toggleGuide: () => void
}

export function usePollOnboarding(
  sessionId: string,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): PollOnboarding {
  const key = storageKey(sessionId)
  const [showIntro, setShowIntro] = useState(() => storage?.getItem(key) !== 'true')
  const [isGuideOpen, setIsGuideOpen] = useState(false)

  const dismissIntro = (): void => {
    storage?.setItem(key, 'true')
    setShowIntro(false)
  }

  const toggleGuide = (): void => setIsGuideOpen((open) => !open)

  return { showIntro, dismissIntro, isGuideOpen, toggleGuide }
}
