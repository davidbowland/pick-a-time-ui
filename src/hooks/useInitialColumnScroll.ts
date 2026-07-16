import { RefObject, useLayoutEffect } from 'react'

export interface ColumnScrollMetrics {
  containerWidth: number
  labelWidth: number
  columnWidth: number
  columnGap: number
}

// Finds the start index of the highest-scoring contiguous run of `visibleColumns` columns out
// of `columnCount` total, breaking ties toward the smallest start index by only replacing the
// running best on a strictly greater sum.
export function bestScrollWindow(columnCount: number, visibleColumns: number, scores: number[]): number {
  const windowSize = Math.max(1, Math.min(columnCount, visibleColumns))
  if (windowSize >= columnCount) return 0

  let bestStart = 0
  let bestSum = -Infinity
  for (let start = 0; start <= columnCount - windowSize; start++) {
    let sum = 0
    for (let i = start; i < start + windowSize; i++) sum += scores[i] ?? 0
    if (sum > bestSum) {
      bestSum = sum
      bestStart = start
    }
  }
  return bestStart
}

function defaultMeasure(container: HTMLDivElement): ColumnScrollMetrics | null {
  const label = container.querySelector<HTMLElement>('[data-scroll-label]')
  const columns = Array.from(container.querySelectorAll<HTMLElement>('[data-scroll-column]'))
  if (!label || columns.length === 0) return null

  const firstRect = columns[0].getBoundingClientRect()
  const gap = columns.length > 1 ? columns[1].getBoundingClientRect().left - firstRect.right : 0
  return {
    columnGap: Math.max(0, gap),
    columnWidth: firstRect.width,
    containerWidth: container.clientWidth,
    labelWidth: label.getBoundingClientRect().width,
  }
}

// Positions a scrollable grid's initial horizontal scroll to the window of columns with the
// highest combined score (e.g. most actionable cells, or most people free), instead of always
// starting at column 0. Runs once, on mount, using the scores/columnCount as they exist at first
// render — re-running on every later data change (e.g. every cell toggled) would fight the
// user's own subsequent scrolling rather than help them.
export function useInitialColumnScroll(
  containerRef: RefObject<HTMLDivElement | null>,
  columnCount: number,
  scores: number[],
  measure: (container: HTMLDivElement) => ColumnScrollMetrics | null = defaultMeasure,
): void {
  useLayoutEffect(() => {
    const container = containerRef.current
    if (!container || columnCount <= 1) return

    const metrics = measure(container)
    if (!metrics || metrics.columnWidth <= 0) return

    const trackSize = metrics.columnWidth + metrics.columnGap
    const visibleWidth = metrics.containerWidth - metrics.labelWidth + metrics.columnGap
    const visibleColumns = Math.floor(visibleWidth / trackSize)

    const bestStart = bestScrollWindow(columnCount, visibleColumns, scores)
    container.scrollLeft = bestStart * trackSize
  }, [])
}
