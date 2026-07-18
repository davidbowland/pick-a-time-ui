import { RefObject } from 'react'

import { useScrollEdges } from './useScrollEdges'
import { act, renderHook } from '@testing-library/react'

interface ScrollState {
  scrollLeft: number
  scrollWidth: number
  clientWidth: number
  scrollTop: number
  scrollHeight: number
  clientHeight: number
}

function scrollportWith(state: ScrollState): HTMLDivElement {
  const el = document.createElement('div')
  for (const [key, value] of Object.entries(state)) {
    Object.defineProperty(el, key, { configurable: true, value, writable: true })
  }
  return el
}

// Built once per test and reused across renders — a fresh `{ current: el }` object on every
// invocation would change identity every render, retriggering the hook's effect indefinitely.
function refTo(el: HTMLElement | null): RefObject<HTMLElement | null> {
  return { current: el }
}

describe('useScrollEdges', () => {
  it('reports all edges closed when there is nothing to scroll', () => {
    const el = scrollportWith({
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 100,
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 100,
    })
    const ref = refTo(el)
    const { result } = renderHook(() => useScrollEdges(ref, 0))

    expect(result.current).toEqual({
      canScrollDown: false,
      canScrollLeft: false,
      canScrollRight: false,
      canScrollUp: false,
    })
  })

  it('reports the right/down edges open when content overflows and the scrollport starts at the origin', () => {
    const el = scrollportWith({
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 300,
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 300,
    })
    const ref = refTo(el)
    const { result } = renderHook(() => useScrollEdges(ref, 0))

    expect(result.current).toEqual({
      canScrollDown: true,
      canScrollLeft: false,
      canScrollRight: true,
      canScrollUp: false,
    })
  })

  it('reports the left/up edges open when the scrollport starts already scrolled past the origin', () => {
    // Mirrors useInitialColumnScroll landing the grid scrolled right on first mount — the "more
    // to the left" affordance must be correct from the very first render, not just after a scroll.
    const el = scrollportWith({
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 300,
      scrollLeft: 150,
      scrollTop: 50,
      scrollWidth: 300,
    })
    const ref = refTo(el)
    const { result } = renderHook(() => useScrollEdges(ref, 0))

    expect(result.current).toEqual({
      canScrollDown: true,
      canScrollLeft: true,
      canScrollRight: true,
      canScrollUp: true,
    })
  })

  it('updates when the scrollport actually scrolls', () => {
    const el = scrollportWith({
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 300,
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 300,
    })
    const ref = refTo(el)
    const { result } = renderHook(() => useScrollEdges(ref, 0))

    act(() => {
      el.scrollLeft = 200
      el.dispatchEvent(new Event('scroll'))
    })

    expect(result.current.canScrollLeft).toBe(true)
    expect(result.current.canScrollRight).toBe(false)
  })

  it('remeasures when contentKey changes, even though the scrollport element itself is unchanged', () => {
    const el = scrollportWith({
      clientHeight: 100,
      clientWidth: 100,
      scrollHeight: 100,
      scrollLeft: 0,
      scrollTop: 0,
      scrollWidth: 100,
    })
    const ref = refTo(el)
    const { result, rerender } = renderHook(({ contentKey }) => useScrollEdges(ref, contentKey), {
      initialProps: { contentKey: 0 },
    })

    expect(result.current.canScrollRight).toBe(false)

    Object.defineProperty(el, 'scrollWidth', { configurable: true, value: 300 })
    rerender({ contentKey: 1 })

    expect(result.current.canScrollRight).toBe(true)
  })

  it('does nothing when the ref has no element yet', () => {
    const ref = refTo(null)
    const { result } = renderHook(() => useScrollEdges(ref, 0))

    expect(result.current).toEqual({
      canScrollDown: false,
      canScrollLeft: false,
      canScrollRight: false,
      canScrollUp: false,
    })
  })
})
