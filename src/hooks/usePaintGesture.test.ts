import { act, renderHook } from '@testing-library/react'

import { usePaintGesture } from './usePaintGesture'

describe('usePaintGesture', () => {
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

  it('should commit only the cells that actually changed on release', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => {
      result.current.startPaint(0, 0)
      result.current.continuePaint(0, 1)
      result.current.endPaint()
    })

    expect(onCommit).toHaveBeenCalledWith([
      { hourIndex: 0, dayIndex: 0, value: true },
      { hourIndex: 0, dayIndex: 1, value: true },
    ])
  })

  it('should not commit when the gesture touched no cells', () => {
    const onCommit = jest.fn()
    const { result } = renderHook(() => usePaintGesture(grid, onCommit))

    act(() => result.current.endPaint())

    expect(onCommit).not.toHaveBeenCalled()
  })
})
