import { act, renderHook } from '@testing-library/react'

import { useIsIntersecting } from './useIsIntersecting'

describe('useIsIntersecting', () => {
  function setup(): {
    element: HTMLDivElement
    fireEntry: (isIntersecting: boolean) => void
    observe: jest.Mock
    disconnect: jest.Mock
    createObserver: jest.Mock
    } {
    const element = document.createElement('div')
    document.body.appendChild(element)
    const observe = jest.fn()
    const disconnect = jest.fn()
    let capturedCallback: IntersectionObserverCallback = () => {}

    const createObserver = jest.fn((cb: IntersectionObserverCallback) => {
      capturedCallback = cb
      return { observe, disconnect, unobserve: jest.fn() } as unknown as IntersectionObserver
    })

    const fireEntry = (isIntersecting: boolean): void => {
      capturedCallback(
        [{ isIntersecting, target: element } as unknown as IntersectionObserverEntry],
        {} as IntersectionObserver,
      )
    }

    return { element, fireEntry, observe, disconnect, createObserver }
  }

  it('defaults to false before any observation fires', () => {
    const { element, createObserver } = setup()
    const ref = { current: element }
    const { result } = renderHook(() => useIsIntersecting(ref, createObserver))
    expect(result.current).toBe(false)
  })

  it('observes the ref target element', () => {
    const { element, observe, createObserver } = setup()
    const ref = { current: element }
    renderHook(() => useIsIntersecting(ref, createObserver))
    expect(observe).toHaveBeenCalledWith(element)
  })

  it('updates to true when the element starts intersecting', () => {
    const { element, fireEntry, createObserver } = setup()
    const ref = { current: element }
    const { result } = renderHook(() => useIsIntersecting(ref, createObserver))
    act(() => fireEntry(true))
    expect(result.current).toBe(true)
  })

  it('updates back to false when the element stops intersecting', () => {
    const { element, fireEntry, createObserver } = setup()
    const ref = { current: element }
    const { result } = renderHook(() => useIsIntersecting(ref, createObserver))
    act(() => fireEntry(true))
    act(() => fireEntry(false))
    expect(result.current).toBe(false)
  })

  it('disconnects the observer on unmount', () => {
    const { element, disconnect, createObserver } = setup()
    const ref = { current: element }
    const { unmount } = renderHook(() => useIsIntersecting(ref, createObserver))
    unmount()
    expect(disconnect).toHaveBeenCalledTimes(1)
  })

  it('does nothing when the ref has no current element', () => {
    const createObserver = jest.fn()
    const ref = { current: null }
    renderHook(() => useIsIntersecting(ref, createObserver))
    expect(createObserver).not.toHaveBeenCalled()
  })
})
