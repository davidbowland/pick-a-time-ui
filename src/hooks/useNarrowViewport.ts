import { useEffect, useState } from 'react'

// Tailwind's `md` boundary, read in JS because the consumer is a boolean prop, not a class. Not a new
// breakpoint — the same 768px the rest of the app already uses.
const QUERY = '(max-width: 767px)'

// Seeds `false` during the static export -- there is no `window` to measure -- and is correct from the
// first client render. So NEVER render markup straight off this value: the served HTML would always be
// the wide branch while a narrow device hydrates as `true`, and React 19 answers a hydration mismatch by
// throwing away the whole root's hydration, which client-renders the entire page rather than one node.
// AND it with client state that is itself seeded `false` (as `pages/index.tsx` does with `dockOpen`) so
// the two renders agree. That AND is load-bearing, not incidental.
export function useNarrowViewport(): boolean {
  const [mediaQueryList] = useState<MediaQueryList | undefined>(() =>
    typeof window === 'undefined' ? undefined : window.matchMedia(QUERY),
  )
  const [isNarrow, setIsNarrow] = useState(() => mediaQueryList?.matches ?? false)

  useEffect(() => {
    if (!mediaQueryList) return
    const handleChange = (event: MediaQueryListEvent): void => setIsNarrow(event.matches)
    mediaQueryList.addEventListener('change', handleChange)
    return () => mediaQueryList.removeEventListener('change', handleChange)
  }, [mediaQueryList])

  return isNarrow
}
