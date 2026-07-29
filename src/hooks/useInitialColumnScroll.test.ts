import { RefObject } from 'react'

import { bestScrollWindow, ColumnScrollMetrics, defaultMeasure, useInitialColumnScroll } from './useInitialColumnScroll'
import { renderHook } from '@testing-library/react'

describe('bestScrollWindow', () => {
  it('returns 0 when the visible window already covers every column', () => {
    expect(bestScrollWindow(4, 4, [1, 2, 3, 4])).toBe(0)
    expect(bestScrollWindow(4, 10, [1, 2, 3, 4])).toBe(0)
  })

  it('picks the start index of the highest-scoring window', () => {
    // windows of size 2: [1,1]=2 [1,5]=6 [5,1]=6 [1,9]=10 [9,1]=10 -> starts 3 or 4 tie at 10; breaks toward leftmost
    expect(bestScrollWindow(6, 2, [1, 1, 5, 1, 9, 1])).toBe(3)
  })

  it('breaks ties toward the leftmost (smallest) start index', () => {
    // windows of size 2, all sums equal (3): starts 0,1,2
    expect(bestScrollWindow(4, 2, [1, 2, 1, 2])).toBe(0)
  })

  it('treats missing scores as 0', () => {
    expect(bestScrollWindow(4, 2, [0, 0])).toBe(0)
  })

  it('clamps a visible-column count larger than the total down to all columns', () => {
    expect(bestScrollWindow(3, 99, [1, 1, 1])).toBe(0)
  })

  it('clamps a visible-column count below 1 up to 1', () => {
    // window size 1: best single score is index 2 (value 9)
    expect(bestScrollWindow(3, 0, [1, 9, 2])).toBe(1)
  })
})

function makeContainer(): HTMLDivElement {
  const container = document.createElement('div')
  document.body.appendChild(container)
  return container
}

function mockRect(el: HTMLElement, left: number, width: number): void {
  el.getBoundingClientRect = (): DOMRect =>
    ({ left, right: left + width, width, bottom: 0, height: 0, top: 0, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
}

describe('useInitialColumnScroll', () => {
  it('does nothing when there is 1 or fewer columns', () => {
    const container = makeContainer()
    const measure = jest.fn()
    renderHook(() =>
      useInitialColumnScroll({ current: container } as RefObject<HTMLDivElement | null>, 1, [5], measure),
    )
    expect(measure).not.toHaveBeenCalled()
    expect(container.scrollLeft).toBe(0)
  })

  it('does nothing when the container ref is not attached', () => {
    const measure = jest.fn()
    renderHook(() =>
      useInitialColumnScroll({ current: null } as RefObject<HTMLDivElement | null>, 4, [1, 2, 3, 4], measure),
    )
    expect(measure).not.toHaveBeenCalled()
  })

  it('does nothing when measure reports no metrics', () => {
    const container = makeContainer()
    renderHook(() =>
      useInitialColumnScroll({ current: container } as RefObject<HTMLDivElement | null>, 4, [1, 2, 3, 4], () => null),
    )
    expect(container.scrollLeft).toBe(0)
  })

  it('does nothing when the measured column width is 0', () => {
    const container = makeContainer()
    const metrics: ColumnScrollMetrics = { columnGap: 4, columnWidth: 0, containerWidth: 300, labelWidth: 96 }
    renderHook(() =>
      useInitialColumnScroll(
        { current: container } as RefObject<HTMLDivElement | null>,
        4,
        [1, 2, 3, 4],
        () => metrics,
      ),
    )
    expect(container.scrollLeft).toBe(0)
  })

  it("sets scrollLeft to the best window's pixel offset", () => {
    const container = makeContainer()
    // containerWidth 300, labelWidth 100 -> 200px visible; columnWidth 56 + gap 4 = 60px/track -> 3 visible columns
    const metrics: ColumnScrollMetrics = { columnGap: 4, columnWidth: 56, containerWidth: 300, labelWidth: 100 }
    // 6 columns, scores concentrate around index 4-5
    const scores = [1, 1, 1, 9, 9, 9]
    renderHook(() =>
      useInitialColumnScroll({ current: container } as RefObject<HTMLDivElement | null>, 6, scores, () => metrics),
    )
    // best 3-wide window is [3,4,5] (sum 27) -> start 3 -> scrollLeft = 3 * 60 = 180
    expect(container.scrollLeft).toBe(180)
  })

  it('leaves scrollLeft at 0 when every column already fits', () => {
    const container = makeContainer()
    const metrics: ColumnScrollMetrics = { columnGap: 4, columnWidth: 56, containerWidth: 1000, labelWidth: 100 }
    renderHook(() =>
      useInitialColumnScroll({ current: container } as RefObject<HTMLDivElement | null>, 3, [1, 2, 3], () => metrics),
    )
    expect(container.scrollLeft).toBe(0)
  })

  it('default measure reads label and column elements from data attributes', () => {
    const container = makeContainer()
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 300 })

    const label = document.createElement('div')
    label.setAttribute('data-scroll-label', '')
    mockRect(label, 0, 100)
    container.appendChild(label)

    const columnWidths = [56, 56, 56, 56]
    let cursor = 100
    for (const width of columnWidths) {
      const column = document.createElement('div')
      column.setAttribute('data-scroll-column', '')
      mockRect(column, cursor, width)
      container.appendChild(column)
      cursor += width + 4
    }

    renderHook(() =>
      useInitialColumnScroll({ current: container } as RefObject<HTMLDivElement | null>, 4, [1, 1, 1, 1]),
    )
    // Everything fits (4 columns * 60px = 240 <= 300 - 100 = 200 is false actually: 4*60=240 > 200,
    // so only 3 columns are visible; all scores equal -> leftmost window (start 0) wins -> scrollLeft 0
    expect(container.scrollLeft).toBe(0)
  })

  it('default measure returns null when there are no column elements', () => {
    const container = makeContainer()
    const label = document.createElement('div')
    label.setAttribute('data-scroll-label', '')
    mockRect(label, 0, 100)
    container.appendChild(label)

    renderHook(() =>
      useInitialColumnScroll({ current: container } as RefObject<HTMLDivElement | null>, 4, [1, 2, 3, 4]),
    )
    expect(container.scrollLeft).toBe(0)
  })
})

describe('defaultMeasure', () => {
  // clientWidth is defined on each freshly created container instance, never on a prototype, so
  // there is nothing to restore and nothing that can leak into a later test — unlike
  // components/poll/test-column-layout-mock.ts, which patches Element/HTMLElement prototypes
  // globally and therefore needs a careful teardown.
  const stubRect = (element: HTMLElement, rect: { left: number; right: number; width: number }): void => {
    element.getBoundingClientRect = () => ({
      ...rect,
      bottom: 0,
      height: 0,
      toJSON: () => ({}),
      top: 0,
      x: rect.left,
      y: 0,
    })
  }

  const buildColumn = (left: number): HTMLDivElement => {
    const column = document.createElement('div')
    column.setAttribute('data-scroll-column', '')
    stubRect(column, { left, right: left + 48, width: 48 })
    return column
  }

  const buildContainer = (options: { columnCount: number; withLabel: boolean }): HTMLDivElement => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 300 })
    const label = document.createElement('div')
    label.setAttribute('data-scroll-label', '')
    stubRect(label, { left: 0, right: 72, width: 72 })
    const columns = Array.from({ length: options.columnCount }, (_, index) => buildColumn(76 + index * 52))
    container.append(...(options.withLabel ? [label] : []), ...columns)
    return container
  }

  // Columns laid out right to left (an RTL locale) put the second column's left edge *before* the
  // first column's right edge, so the raw subtraction is negative and must clamp rather than
  // propagate a negative track size into the scroll offset.
  const buildReversedContainer = (): HTMLDivElement => {
    const container = document.createElement('div')
    Object.defineProperty(container, 'clientWidth', { value: 300 })
    container.append(buildColumn(200), buildColumn(148))
    return container
  }

  it('measures the label column when it is present', () => {
    expect(defaultMeasure(buildContainer({ columnCount: 2, withLabel: true }))).toEqual({
      columnGap: 4,
      columnWidth: 48,
      containerWidth: 300,
      labelWidth: 72,
    })
  })

  it('measures with a zero label width when no label column is rendered', () => {
    expect(defaultMeasure(buildContainer({ columnCount: 2, withLabel: false }))).toEqual({
      columnGap: 4,
      columnWidth: 48,
      containerWidth: 300,
      labelWidth: 0,
    })
  })

  it('reports a zero gap when there is only one column to measure', () => {
    expect(defaultMeasure(buildContainer({ columnCount: 1, withLabel: true }))?.columnGap).toBe(0)
  })

  it('clamps a negative gap to zero when columns are laid out right to left', () => {
    expect(defaultMeasure(buildReversedContainer())?.columnGap).toBe(0)
  })

  it('returns null when there are no columns to measure', () => {
    const container = document.createElement('div')
    expect(defaultMeasure(container)).toBeNull()
  })
})
