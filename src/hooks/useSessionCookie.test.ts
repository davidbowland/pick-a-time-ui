import { renderHook, act } from '@testing-library/react'
import Cookies from 'js-cookie'

import { useSessionCookie } from './useSessionCookie'

jest.mock('js-cookie')

describe('useSessionCookie', () => {
  const mockGet = jest.mocked(Cookies.get)
  const mockSet = jest.mocked(Cookies.set)
  const mockRemove = jest.mocked(Cookies.remove)

  function setup(protocol: 'https:' | 'http:' = 'https:'): void {
    Object.defineProperty(window, 'location', { value: { protocol }, writable: true })
  }

  it('should read userId from cookie on mount', () => {
    setup()
    mockGet.mockReturnValueOnce('user-123' as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    expect(mockGet).toHaveBeenCalledWith('pat_user_abc')
    expect(result.current.userId).toBe('user-123')
  })

  it('should return undefined when no cookie exists', () => {
    setup()
    mockGet.mockReturnValueOnce(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    expect(result.current.userId).toBeUndefined()
  })

  it('should set cookie and update state', () => {
    setup()
    mockGet.mockReturnValueOnce(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))
    act(() => result.current.setUserId('user-456'))

    expect(mockSet).toHaveBeenCalledWith('pat_user_abc', 'user-456', {
      path: '/p/abc',
      expires: 1,
      sameSite: 'Strict',
      secure: true,
    })
    expect(result.current.userId).toBe('user-456')
  })

  it('should set secure to false on http', () => {
    setup('http:')
    mockGet.mockReturnValueOnce(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))
    act(() => result.current.setUserId('user-456'))

    expect(mockSet).toHaveBeenCalledWith('pat_user_abc', 'user-456', expect.objectContaining({ secure: false }))
  })

  it('should clear cookie and reset state', () => {
    setup()
    mockGet.mockReturnValueOnce('user-123' as any)

    const { result } = renderHook(() => useSessionCookie('abc'))
    act(() => result.current.clearUserId())

    expect(mockRemove).toHaveBeenCalledWith('pat_user_abc', { path: '/p/abc' })
    expect(result.current.userId).toBeUndefined()
  })
})
