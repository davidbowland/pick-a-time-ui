import { act, renderHook } from '@testing-library/react'

import { usePaintGesture } from './usePaintGesture'

describe('usePaintGesture', () => {
  beforeAll(() => {
    jest.useFakeTimers()
  })

  afterAll(() => {
    jest.useRealTimers()
  })

  const grid = [
    [false, false],
    [false, false],
  ]

  it('should mark a cell on and report it as dirty while painting', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => result.current.startPaint(0, 0))

    expect(result.current.isOn(0, 0)).toBe(true)
    expect(onCommit).not.toHaveBeenCalled()
  })

  it('should toggle off when starting on an already-on cell', () => {
    const onCommit = jest.fn()
    const onGrid = [
      [true, false],
      [false, false],
    ]
    const { result } = renderHook(() => usePaintGesture(onGrid, onCommit))

    act(() => result.current.startPaint(0, 0))

    expect(result.current.isOn(0, 0)).toBe(false)
  })

  it('should paint additional cells the same way during the drag', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => {
      result.current.startPaint(0, 0)
      result.current.continuePaint(0, 1)
      result.current.continuePaint(1, 0)
    })

    expect(result.current.isOn(0, 0)).toBe(true)
    expect(result.current.isOn(0, 1)).toBe(true)
    expect(result.current.isOn(1, 0)).toBe(true)
  })

  it('should commit only the cells that actually changed on release, keyed by dateIndex/slotIndex', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => {
      result.current.startPaint(0, 0)
      result.current.continuePaint(0, 1)
      result.current.endPaint()
    })

    expect(onCommit).toHaveBeenCalledWith([
      { dateIndex: 0, slotIndex: 0, value: true },
      { dateIndex: 0, slotIndex: 1, value: true },
    ])
  })

  it('should not commit when the gesture touched no cells', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => result.current.endPaint())

    expect(onCommit).not.toHaveBeenCalled()
  })

  it('should keep showing the painted value until after onCommit has had a chance to land, not clear it immediately', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => {
      result.current.startPaint(0, 0)
      result.current.endPaint()
    })

    // The caller's own commit (e.g. an optimistic query-cache write) is scheduled by the caller
    // via a macrotask-based mechanism — clearing the overlay before that lands would render a
    // beat showing the pre-paint base grid value instead, which is the flash this guards against.
    expect(result.current.isOn(0, 0)).toBe(true)

    act(() => jest.runAllTimers())

    expect(result.current.isOn(0, 0)).toBe(false)
  })
})
