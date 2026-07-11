import { renderHook, act } from '@testing-library/react'

import { usePhoneInput } from './use-phone-input'

describe('usePhoneInput', () => {
  it('should start with empty value and no error', () => {
    const { result } = renderHook(() => usePhoneInput())
    expect(result.current.value).toBe('')
    expect(result.current.error).toBe('')
    expect(result.current.isValid).toBe(false)
  })

  it('should format input through formatPhoneUS on change', () => {
    const { result } = renderHook(() => usePhoneInput())
    act(() => result.current.onChange('2125551234'))
    expect(result.current.value).toBe('+12125551234')
    expect(result.current.isValid).toBe(true)
  })

  it('should not show error before showError is called', () => {
    const { result } = renderHook(() => usePhoneInput())
    act(() => result.current.onChange('212'))
    expect(result.current.error).toBe('')
  })

  it('should show error after showError for invalid input', () => {
    const { result } = renderHook(() => usePhoneInput())
    act(() => result.current.onChange('212'))
    act(() => result.current.showError())
    expect(result.current.error).toBe('Invalid phone number. Be sure to include area code.')
  })

  it('should clear error when onChange is called after showError', () => {
    const { result } = renderHook(() => usePhoneInput())
    act(() => result.current.onChange('212'))
    act(() => result.current.showError())
    expect(result.current.error).not.toBe('')

    act(() => result.current.onChange('2125'))
    expect(result.current.error).toBe('')
  })

  it('should not show error after showError for valid input', () => {
    const { result } = renderHook(() => usePhoneInput())
    act(() => result.current.onChange('2125551234'))
    act(() => result.current.showError())
    expect(result.current.error).toBe('')
  })

  it('should not show error after showError for empty input', () => {
    const { result } = renderHook(() => usePhoneInput())
    act(() => result.current.showError())
    expect(result.current.error).toBe('')
  })

  it('should reset value and submitted state', () => {
    const { result } = renderHook(() => usePhoneInput())
    act(() => result.current.onChange('212'))
    act(() => result.current.showError())
    expect(result.current.error).not.toBe('')

    act(() => result.current.reset())
    expect(result.current.value).toBe('')
    expect(result.current.error).toBe('')
    expect(result.current.isValid).toBe(false)
  })
})
