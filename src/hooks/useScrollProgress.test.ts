import { act, renderHook } from '@testing-library/react'

import { useScrollProgress } from './useScrollProgress'

function mockScrollMetrics(scrollTop: number, scrollHeight: number, clientHeight: number): void {
  Object.defineProperty(document.documentElement, 'scrollTop', { configurable: true, value: scrollTop })
  Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: scrollHeight })
  Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: clientHeight })
}

describe('useScrollProgress', () => {
  beforeAll(() => {
    window.requestAnimationFrame = ((cb: FrameRequestCallback): number => {
      cb(0)
      return 0
    }) as typeof requestAnimationFrame
  })

  it('reports 0 when the page has no scrollable range', () => {
    mockScrollMetrics(0, 800, 800)
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current).toBe(0)
  })

  it('reports scroll position as a 0-1 fraction of the scrollable range', () => {
    mockScrollMetrics(300, 1000, 400) // max = 600
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current).toBeCloseTo(0.5)
  })

  it('updates when a scroll event fires', () => {
    mockScrollMetrics(0, 1000, 500) // max = 500
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current).toBe(0)

    mockScrollMetrics(250, 1000, 500)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(result.current).toBeCloseTo(0.5)
  })

  it('clamps to 1 even if scrollTop exceeds the measured range', () => {
    mockScrollMetrics(9999, 1000, 500)
    const { result } = renderHook(() => useScrollProgress())
    expect(result.current).toBe(1)
  })

  it('skips scroll-driven updates entirely under prefers-reduced-motion', () => {
    jest.mocked(window.matchMedia).mockReturnValueOnce({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    } as unknown as MediaQueryList)
    mockScrollMetrics(0, 1000, 500)
    const { result } = renderHook(() => useScrollProgress())
    mockScrollMetrics(999, 1000, 500)
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    // No listener was attached, so the second measurement never gets picked up.
    expect(result.current).toBe(0)
  })

  it('cancels the in-flight animation frame on unmount', () => {
    mockScrollMetrics(0, 1000, 500)
    const scheduledFrameId = 42
    const originalRaf = window.requestAnimationFrame
    const originalCaf = window.cancelAnimationFrame
    window.requestAnimationFrame = jest.fn().mockReturnValue(scheduledFrameId) as typeof requestAnimationFrame
    window.cancelAnimationFrame = jest.fn()

    const { unmount } = renderHook(() => useScrollProgress())

    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    unmount()

    expect(window.cancelAnimationFrame).toHaveBeenCalledWith(scheduledFrameId)

    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCaf
  })

  it('does not permanently deadlock scroll updates when the effect tears down and rebuilds while a frame is in flight', () => {
    mockScrollMetrics(0, 1000, 500)
    const originalRaf = window.requestAnimationFrame
    const originalCaf = window.cancelAnimationFrame

    let nextFrameId = 0
    const pendingFrames = new Set<number>()
    window.requestAnimationFrame = jest.fn(() => {
      nextFrameId += 1
      pendingFrames.add(nextFrameId)
      // Deliberately never invoke the callback, so the frame stays "in flight"
      // until it is either cancelled or the test ends.
      return nextFrameId
    }) as typeof requestAnimationFrame
    window.cancelAnimationFrame = jest.fn((id: number) => {
      pendingFrames.delete(id)
    }) as typeof cancelAnimationFrame

    // A getDocument that changes identity every render forces the effect to
    // tear down and rebuild on each rerender, standing in for a real-world
    // re-render race (e.g. a concurrent IntersectionObserver-driven update)
    // that happens to land while a scroll-scheduled frame is still pending.
    const { rerender } = renderHook(({ getDocument }) => useScrollProgress(getDocument), {
      initialProps: { getDocument: (): Document => document },
    })

    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(1)
    expect(pendingFrames.size).toBe(1)

    // Simulate the re-render race: the effect tears down (cancelling the
    // in-flight frame, which never gets a chance to reset tickingRef itself)
    // and rebuilds before the pending frame fires.
    rerender({ getDocument: (): Document => document })

    expect(window.cancelAnimationFrame).toHaveBeenCalledTimes(1)
    expect(pendingFrames.size).toBe(0)

    // If tickingRef were stuck `true`, this second scroll event would be
    // swallowed and no new frame would be scheduled — the bug this test guards
    // against.
    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2)

    window.requestAnimationFrame = originalRaf
    window.cancelAnimationFrame = originalCaf
  })

  it('does not tear down and rebuild the scroll listener on a benign re-render (stable default getDocument)', () => {
    mockScrollMetrics(0, 1000, 500)
    const addSpy = jest.spyOn(window, 'addEventListener')
    const removeSpy = jest.spyOn(window, 'removeEventListener')

    const { rerender } = renderHook(() => useScrollProgress())

    const scrollAddCallsAfterMount = addSpy.mock.calls.filter(([type]) => type === 'scroll').length
    expect(scrollAddCallsAfterMount).toBe(1)

    // Re-render with no changes to the hook's arguments, standing in for a
    // benign parent re-render unrelated to scroll.
    rerender()

    expect(removeSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(0)
    expect(addSpy.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(scrollAddCallsAfterMount)

    addSpy.mockRestore()
    removeSpy.mockRestore()
  })
})
