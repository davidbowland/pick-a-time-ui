import { useHasWebShare } from './useHasWebShare'
import { renderHook } from '@testing-library/react'

describe('useHasWebShare', () => {
  it('resolves to true when the injected detector reports support', () => {
    const { result } = renderHook(() => useHasWebShare(() => true))
    expect(result.current).toBe(true)
  })

  it('resolves to false when the injected detector reports no support', () => {
    const { result } = renderHook(() => useHasWebShare(() => false))
    expect(result.current).toBe(false)
  })

  it('uses the default detector when none is injected, resolving false in an environment without navigator.share', () => {
    const { result } = renderHook(() => useHasWebShare())
    expect(result.current).toBe(false)
  })
})
