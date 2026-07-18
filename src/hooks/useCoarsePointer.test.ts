import { act, renderHook } from '@testing-library/react'

import { useCoarsePointer } from './useCoarsePointer'

function mockMatchMedia(matches: boolean): { addEventListener: jest.Mock; removeEventListener: jest.Mock } {
  const addEventListener = jest.fn()
  const removeEventListener = jest.fn()
  jest.mocked(window.matchMedia).mockReturnValueOnce({
    matches,
    media: '(pointer: coarse)',
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener,
    removeEventListener,
    dispatchEvent: jest.fn(),
  } as unknown as MediaQueryList)
  return { addEventListener, removeEventListener }
}

describe('useCoarsePointer', () => {
  it('returns false when the primary pointer is fine', () => {
    mockMatchMedia(false)
    const { result } = renderHook(() => useCoarsePointer())
    expect(result.current).toBe(false)
  })

  it('returns true when the primary pointer is coarse', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useCoarsePointer())
    expect(result.current).toBe(true)
  })

  it('updates when the pointer characteristic changes after mount', () => {
    const { addEventListener } = mockMatchMedia(false)
    const { result } = renderHook(() => useCoarsePointer())
    expect(result.current).toBe(false)

    const handleChange = addEventListener.mock.calls.find(([type]) => type === 'change')?.[1]
    act(() => {
      handleChange({ matches: true } as MediaQueryListEvent)
    })

    expect(result.current).toBe(true)
  })

  it('removes its change listener on unmount', () => {
    const { removeEventListener } = mockMatchMedia(false)
    const { unmount } = renderHook(() => useCoarsePointer())

    unmount()

    expect(removeEventListener).toHaveBeenCalledWith('change', expect.any(Function))
  })
})
