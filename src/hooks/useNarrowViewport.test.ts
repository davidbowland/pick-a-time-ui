import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

import { useNarrowViewport } from './useNarrowViewport'
import { act, renderHook } from '@testing-library/react'

function mockMatchMedia(matches: boolean): { addEventListener: jest.Mock; removeEventListener: jest.Mock } {
  const addEventListener = jest.fn()
  const removeEventListener = jest.fn()
  jest.mocked(window.matchMedia).mockReturnValueOnce({
    matches,
    media: '(max-width: 767px)',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener,
    removeEventListener,
    dispatchEvent: jest.fn(),
  } as unknown as MediaQueryList)
  return { addEventListener, removeEventListener }
}

describe('useNarrowViewport', () => {
  it('asks for Tailwind’s md boundary rather than a breakpoint of its own', () => {
    mockMatchMedia(false)
    renderHook(() => useNarrowViewport())
    expect(window.matchMedia).toHaveBeenCalledWith('(max-width: 767px)')
  })

  it('returns false when the viewport is at or above md', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useNarrowViewport())
    expect(result.current).toBe(false)
  })

  it('returns true when the viewport is already below md', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useNarrowViewport())
    expect(result.current).toBe(true)
  })

  it('updates when the viewport crosses the boundary after mount', () => {
    const { addEventListener } = mockMatchMedia(false)
    const { result } = renderHook(() => useNarrowViewport())
    expect(result.current).toBe(false)

    const handleChange = addEventListener.mock.calls.find(([type]) => type === 'change')?.[1]
    act(() => {
      handleChange({ matches: true } as MediaQueryListEvent)
    })

    expect(result.current).toBe(true)
  })

  it('updates again when the viewport crosses back', () => {
    const { addEventListener } = mockMatchMedia(true)
    const { result } = renderHook(() => useNarrowViewport())

    const handleChange = addEventListener.mock.calls.find(([type]) => type === 'change')?.[1]
    act(() => {
      handleChange({ matches: false } as MediaQueryListEvent)
    })

    expect(result.current).toBe(false)
  })

  it('removes its change listener on unmount', () => {
    const { removeEventListener } = mockMatchMedia(false)
    const { unmount } = renderHook(() => useNarrowViewport())

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })

  // The static export renders this on a server with no `window`. `renderToStaticMarkup` with the
  // global deleted is the only honest way to reach that branch: react-dom's client renderer reads
  // `window` itself, so `renderHook` cannot get there.
  it('renders without a window, so the static export does not crash', () => {
    const Probe = (): React.ReactNode => String(useNarrowViewport())
    const original = globalThis.window
    delete (globalThis as { window?: Window }).window
    try {
      expect(renderToStaticMarkup(React.createElement(Probe))).toBe('false')
    } finally {
      ;(globalThis as { window?: Window }).window = original
    }
  })
})
