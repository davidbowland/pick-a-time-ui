import { useDebouncedAvailabilityCommit } from './useDebouncedAvailabilityCommit'
import { renderHook } from '@testing-library/react'
import { AvailabilityCell } from '@types'

describe('useDebouncedAvailabilityCommit', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  const cellA: AvailabilityCell = { dateIndex: 0, slotIndex: 0, value: true }
  const cellB: AvailabilityCell = { dateIndex: 0, slotIndex: 1, value: true }

  it('should not flush before the delay elapses', () => {
    const onFlush = jest.fn()
    const { result } = renderHook(() => useDebouncedAvailabilityCommit(onFlush, 1250))

    result.current([cellA])
    jest.advanceTimersByTime(1249)

    expect(onFlush).not.toHaveBeenCalled()
  })

  it('should flush the queued cell once the delay elapses', () => {
    const onFlush = jest.fn()
    const { result } = renderHook(() => useDebouncedAvailabilityCommit(onFlush, 1250))

    result.current([cellA])
    jest.advanceTimersByTime(1250)

    expect(onFlush).toHaveBeenCalledWith([cellA])
  })

  it('should merge cells from separate calls that land within the delay into one flush', () => {
    const onFlush = jest.fn()
    const { result } = renderHook(() => useDebouncedAvailabilityCommit(onFlush, 1250))

    result.current([cellA])
    jest.advanceTimersByTime(600)
    result.current([cellB])
    jest.advanceTimersByTime(1250)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([cellA, cellB])
  })

  it('should let a later call overwrite an earlier value for the same cell', () => {
    const onFlush = jest.fn()
    const { result } = renderHook(() => useDebouncedAvailabilityCommit(onFlush, 1250))

    result.current([cellA])
    result.current([{ ...cellA, value: false }])
    jest.advanceTimersByTime(1250)

    expect(onFlush).toHaveBeenCalledTimes(1)
    expect(onFlush).toHaveBeenCalledWith([{ ...cellA, value: false }])
  })

  it('should not flush early just because the caller passes a new onFlush reference on rerender', () => {
    // Mirrors PaintingPhase: it passes an inline (non-memoized) commit function, so `onFlush`
    // gets a new identity on every render — including the render triggered by the very click
    // that just queued a cell. The debounce must not treat that as a reason to flush early.
    const firstOnFlush = jest.fn()
    const secondOnFlush = jest.fn()
    const { result, rerender } = renderHook(({ onFlush }) => useDebouncedAvailabilityCommit(onFlush, 1250), {
      initialProps: { onFlush: firstOnFlush },
    })

    result.current([cellA])
    rerender({ onFlush: secondOnFlush })

    jest.advanceTimersByTime(1249)
    expect(firstOnFlush).not.toHaveBeenCalled()
    expect(secondOnFlush).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(secondOnFlush).toHaveBeenCalledWith([cellA])
    expect(firstOnFlush).not.toHaveBeenCalled()
  })

  it('should flush immediately on unmount so a pending pick is not lost', () => {
    const onFlush = jest.fn()
    const { result, unmount } = renderHook(() => useDebouncedAvailabilityCommit(onFlush, 1250))

    result.current([cellA])
    unmount()

    expect(onFlush).toHaveBeenCalledWith([cellA])
  })

  it('should not flush on unmount when nothing is pending', () => {
    const onFlush = jest.fn()
    const { unmount } = renderHook(() => useDebouncedAvailabilityCommit(onFlush, 1250))

    unmount()

    expect(onFlush).not.toHaveBeenCalled()
  })
})
