import { RefObject, useEffect, useState } from 'react'

export interface ScrollEdges {
  canScrollLeft: boolean
  canScrollRight: boolean
  canScrollUp: boolean
  canScrollDown: boolean
}

const NO_EDGES: ScrollEdges = {
  canScrollDown: false,
  canScrollLeft: false,
  canScrollRight: false,
  canScrollUp: false,
}

// Tracks which directions a scrollport still has more content in, so callers can show a scroll
// affordance only where (and while) it's actually true — e.g. a grid that opens already scrolled
// partway right (see useInitialColumnScroll) needs a "more to the left" hint from the very first
// render, not just after the user scrolls right themselves.
//
// `contentKey` should change whenever the scrollable content's own size might have — e.g. the
// number of columns or dates — so a remeasure runs even though the scrollport element's own box
// size (all the resize listener alone would catch) hasn't changed.
export function useScrollEdges(ref: RefObject<HTMLElement | null>, contentKey: number): ScrollEdges {
  const [edges, setEdges] = useState<ScrollEdges>(NO_EDGES)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = (): void => {
      setEdges({
        canScrollDown: el.scrollTop < el.scrollHeight - el.clientHeight - 1,
        canScrollLeft: el.scrollLeft > 0,
        canScrollRight: el.scrollLeft < el.scrollWidth - el.clientWidth - 1,
        canScrollUp: el.scrollTop > 0,
      })
    }

    measure()
    el.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    return () => {
      el.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [ref, contentKey])

  return edges
}
