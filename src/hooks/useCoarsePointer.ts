import { useEffect, useState } from 'react'

const QUERY = '(pointer: coarse)'

export function useCoarsePointer(): boolean {
  const [mediaQueryList] = useState<MediaQueryList | undefined>(() =>
    typeof window === 'undefined' ? undefined : window.matchMedia(QUERY),
  )
  const [isCoarse, setIsCoarse] = useState(() => mediaQueryList?.matches ?? false)

  useEffect(() => {
    if (!mediaQueryList) return
    const handleChange = (event: MediaQueryListEvent): void => setIsCoarse(event.matches)
    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [mediaQueryList])

  return isCoarse
}
