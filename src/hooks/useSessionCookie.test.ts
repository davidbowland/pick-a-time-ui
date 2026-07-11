import { renderHook, act } from '@testing-library/react'
import Cookies from 'js-cookie'

import { useSessionCookie } from './useSessionCookie'

jest.mock('js-cookie')

describe('useSessionCookie', () => {
  const mockGet = jest.mocked(Cookies.get)
  const mockSet = jest.mocked(Cookies.set)
  const mockRemove = jest.mocked(Cookies.remove)

  beforeEach(() => {
    jest.clearAllMocks()
    Object.defineProperty(window, 'location', {
      value: { protocol: 'https:' },
      writable: true,
    })
  })

  it('should read userId from cookie on mount', () => {
    mockGet.mockReturnValue('user-123' as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    expect(mockGet).toHaveBeenCalledWith('choosee_user_abc')
    expect(result.current.userId).toBe('user-123')
  })

  it('should return undefined when no cookie exists', () => {
    mockGet.mockReturnValue(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    expect(result.current.userId).toBeUndefined()
  })

  it('should set cookie and update state', () => {
    mockGet.mockReturnValue(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    act(() => {
      result.current.setUserId('user-456')
    })

    expect(mockSet).toHaveBeenCalledWith('choosee_user_abc', 'user-456', {
      path: '/s/abc',
      expires: 1,
      sameSite: 'Strict',
      secure: true,
    })
    expect(result.current.userId).toBe('user-456')
  })

  it('should set secure to false on http', () => {
    Object.defineProperty(window, 'location', {
      value: { protocol: 'http:' },
      writable: true,
    })
    mockGet.mockReturnValue(undefined as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    act(() => {
      result.current.setUserId('user-456')
    })

    expect(mockSet).toHaveBeenCalledWith('choosee_user_abc', 'user-456', {
      path: '/s/abc',
      expires: 1,
      sameSite: 'Strict',
      secure: false,
    })
  })

  it('should clear cookie and reset state', () => {
    mockGet.mockReturnValue('user-123' as any)

    const { result } = renderHook(() => useSessionCookie('abc'))

    expect(result.current.userId).toBe('user-123')

    act(() => {
      result.current.clearUserId()
    })

    expect(mockRemove).toHaveBeenCalledWith('choosee_user_abc', { path: '/s/abc' })
    expect(result.current.userId).toBeUndefined()
  })
})
