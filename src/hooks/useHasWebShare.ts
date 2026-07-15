import { useEffect, useState } from 'react'

const defaultDetectSupport = (): boolean => typeof navigator !== 'undefined' && typeof navigator.share === 'function'

export function useHasWebShare(detectSupport: () => boolean = defaultDetectSupport): boolean {
  const [hasWebShare, setHasWebShare] = useState(false)

  useEffect(() => {
    setHasWebShare(detectSupport())
  }, [detectSupport])

  return hasWebShare
}
