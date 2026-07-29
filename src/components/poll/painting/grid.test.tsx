import React from 'react'

import { TimeWindow } from '../slot-columns'
import { mockColumnLayout } from '../test-column-layout-mock'
import PaintGrid, { PaintGridProps } from './grid'
import '@testing-library/jest-dom'
import { act, render, screen } from '@testing-library/react'
import { formatShortDate } from '@utils/dates'

function windowFor(startMinute: number): TimeWindow {
  return { endMinute: startMinute + 30, startMinute }
}

function renderGrid(overrides: Partial<PaintGridProps> = {}): ReturnType<typeof render> {
  const columns = [0, 30, 60, 90, 120, 150].map(windowFor)
  // Derived from whichever dates the test ends up with, exactly the way painting/index.tsx builds
  // them — so overriding `dates` alone can't silently leave the cell labels naming other days.
  const dates = overrides.dates ?? ['2026-07-15', '2026-07-16']
  const props: PaintGridProps = {
    columns,
    dateAriaLabels: dates.map(formatShortDate),
    dates,
    grid: [
      [false, false, true, true, false, false],
      [false, false, false, true, true, false],
    ],
    onCommit: jest.fn(),
    slotAriaLabels: columns.map((c) => `${c.startMinute}`),
    slotLabels: columns.map((c) => ({ dayOffset: 0, label: `${c.startMinute}` })),
    slots: [columns.map((c, slotIndex) => ({ ...c, slotIndex })), columns.map((c, slotIndex) => ({ ...c, slotIndex }))],
    ...overrides,
  }
  return render(<PaintGrid {...props} />)
}

describe('PaintGrid initial scroll', () => {
  it('renders the scroll-measurement attributes the hook relies on', () => {
    const { container } = renderGrid()
    expect(container.querySelector('[data-scroll-label]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-scroll-column]')).toHaveLength(6)
  })

  it('scrolls to the window covering the most actionable (non-disabled) cells across both dates', () => {
    const restore = mockColumnLayout(56, 4, 96, 2)
    try {
      const columns = [0, 30, 60, 90, 120, 150].map(windowFor)
      // date0 only has real slots for columns 0-3 (columns 4,5 render as disabled placeholders for
      // it); date1 only has real slots for columns 2-5 (columns 0,1 disabled for it). Checked state
      // (`grid`) is irrelevant to scoring — deliberately left all-false to prove that.
      const date0Slots = columns.slice(0, 4).map((c, slotIndex) => ({ ...c, slotIndex }))
      const date1Slots = columns.slice(2, 6).map((c, slotIndex) => ({ ...c, slotIndex }))
      const { container } = renderGrid({
        columns,
        grid: [
          [false, false, false, false],
          [false, false, false, false],
        ],
        slotAriaLabels: columns.map((c) => `${c.startMinute}`),
        slotLabels: columns.map((c) => ({ dayOffset: 0, label: `${c.startMinute}` })),
        slots: [date0Slots, date1Slots],
      })

      // scores per column (dates with an actionable cell): [1,1,2,2,1,1] — columns 2,3 are
      // actionable for both dates, the rest for only one. 2 visible columns -> best window is
      // [2,3] (sum 4), start index 2 -> scrollLeft = 2 * 60 = 120
      const scrollport = container.querySelector('.overflow-auto') as HTMLElement
      expect(scrollport.scrollLeft).toBe(120)
    } finally {
      restore()
    }

    // Regression check: restore() must remove the patched own-property so HTMLElement.prototype
    // falls back to inheriting Element.prototype's real clientWidth getter again, rather than
    // leaving every element in later tests permanently stuck reporting the fixed mocked width.
    expect(Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'clientWidth')).toBe(false)
    expect(document.createElement('div').clientWidth).not.toBe(96 + 2 * (56 + 4))
  })

  it('does not scroll when there is only one column', () => {
    const singleColumn = [windowFor(0)]
    const { container } = renderGrid({
      columns: singleColumn,
      slotAriaLabels: [],
      slotLabels: [],
      slots: [[{ ...singleColumn[0], slotIndex: 0 }], [{ ...singleColumn[0], slotIndex: 0 }]],
    })
    const scrollport = container.querySelector('.overflow-auto') as HTMLElement
    expect(scrollport.scrollLeft).toBe(0)
  })
})

describe('PaintGrid semantic table markup', () => {
  // A `position: sticky` element that is itself a raw CSS Grid item loses its stuck position
  // once horizontal scroll nears the end of the scrollable range (a real Chromium layout
  // behavior, not something jsdom can reproduce) — see heat-grid equivalent test for the full
  // explanation. Rendering as a real <table> with sticky <th> cells sidesteps that class of bug
  // entirely, and happens to also give screen readers real row/column header associations.
  it('associates each date label with its row via a real table row header', () => {
    renderGrid()
    expect(screen.getByRole('rowheader', { name: 'Wed, Jul 15' })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: 'Thu, Jul 16' })).toBeInTheDocument()
  })

  it('associates each time slot with its column via a real table column header', () => {
    renderGrid()
    expect(screen.getByRole('columnheader', { name: '0' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: '150' })).toBeInTheDocument()
  })

  it('renders the grid as a real table', () => {
    renderGrid()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

// The colgroup carries every column width under `table-layout: fixed`, and the table's min-width is
// derived from the same column count. One <col> too few and the label column silently unpins,
// dividing evenly with the slots while min-width undercounts by ~5rem — enough for a many-column
// poll on a phone to fall under the WCAG 2.2 SC 2.5.8 24x24 target minimum. Style assertions are
// barred, so this element count is the only thing that can catch it.
describe('PaintGrid colgroup', () => {
  const countTracksAndCells = (container: HTMLElement): { colgroupTracks: number; firstRowCells: number } => ({
    colgroupTracks: container.querySelectorAll('colgroup col').length,
    firstRowCells: container.querySelector('tbody tr')!.children.length,
  })

  it('declares exactly one column track per rendered cell in a multi-date grid', () => {
    const { colgroupTracks, firstRowCells } = countTracksAndCells(
      renderGrid({ dates: ['2026-07-28', '2026-07-29'] }).container,
    )
    expect(colgroupTracks).toBe(firstRowCells)
  })

  it('declares exactly one column track per rendered cell in a single-date grid, which drops the label column', () => {
    const { colgroupTracks, firstRowCells } = countTracksAndCells(
      renderGrid({
        dates: ['2026-07-28'],
        grid: [[false, false, true, true, false, false]],
        slots: [[0, 30, 60, 90, 120, 150].map((start, slotIndex) => ({ ...windowFor(start), slotIndex }))],
      }).container,
    )
    expect(colgroupTracks).toBe(firstRowCells)
  })
})

describe('PaintGrid labels', () => {
  const shortLabels = [
    { dayOffset: 0, label: '9a' },
    { dayOffset: 0, label: '10a' },
  ]
  const longLabels = ['9:00–10:00 AM', '10:00–11:00 AM']

  it('renders short row labels, with the month only on the first row', () => {
    renderGrid({ dates: ['2026-07-28', '2026-07-29'] })
    expect(screen.getByText('Tue Jul 28')).toBeInTheDocument()
    expect(screen.getByText('Wed 29')).toBeInTheDocument()
  })

  it('shows the abbreviated column label as the visible header text', () => {
    renderGrid({ slotAriaLabels: longLabels, slotLabels: shortLabels })
    expect(screen.getByText('9a')).toBeInTheDocument()
  })

  // A `<th scope="col">`'s own text is announced during table navigation, so the abbreviation
  // would otherwise be read out verbatim as "nine a". The aria-label keeps the abbreviation a
  // purely visual economy.
  it('names each column header with the full time range rather than the abbreviation', () => {
    renderGrid({ slotAriaLabels: longLabels, slotLabels: shortLabels })
    expect(screen.getByRole('columnheader', { name: '9:00–10:00 AM' })).toBeInTheDocument()
  })

  it('marks a column that falls on the next day for the viewer', () => {
    renderGrid({
      slotAriaLabels: longLabels,
      slotLabels: [
        { dayOffset: 1, label: '1a' },
        { dayOffset: 0, label: '2a' },
      ],
    })
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('marks a column that falls on the previous day for the viewer', () => {
    renderGrid({
      slotAriaLabels: longLabels,
      slotLabels: [
        { dayOffset: -1, label: '11p' },
        { dayOffset: 0, label: '12a' },
      ],
    })
    expect(screen.getByText('−1')).toBeInTheDocument()
  })

  it('keeps the full unabbreviated time range in each cell label', () => {
    renderGrid({ dates: ['2026-07-28', '2026-07-29'], slotAriaLabels: longLabels, slotLabels: shortLabels })
    expect(screen.getByRole('button', { name: 'Tue, Jul 28, 9:00–10:00 AM' })).toBeInTheDocument()
  })

  // The visible row label drops the month on every row after a month change, which is fine in a
  // column the reader scans top to bottom. A cell's aria-label is the opposite situation — it is
  // the out-of-context announcement for someone who tabbed straight into the middle of the grid —
  // so it takes the long form even when the row header beside it does not.
  it('names each cell with the full date even where the row header omits the month', () => {
    renderGrid({ dates: ['2026-07-28', '2026-07-29'], slotAriaLabels: longLabels, slotLabels: shortLabels })
    expect(screen.getByText('Wed 29')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wed, Jul 29, 9:00–10:00 AM' })).toBeInTheDocument()
  })

  // A `<th scope="row">`'s own text is announced during table navigation, exactly as a
  // `<th scope="col">`'s is, so without an aria-label a row after a month change announces
  // `Wed 29` — a date with no month anywhere in it.
  it('names each row header with the full date while showing the short form', () => {
    renderGrid({ dates: ['2026-07-28', '2026-07-29'] })
    expect(screen.getByRole('rowheader', { name: 'Wed, Jul 29' })).toBeInTheDocument()
    expect(screen.getByText('Wed 29')).toBeInTheDocument()
  })
})

describe('PaintGrid single-date polls', () => {
  it('renders no row header for a single-date poll', () => {
    renderGrid({ dates: ['2026-07-28'] })
    expect(screen.queryByRole('rowheader')).not.toBeInTheDocument()
  })

  it('renders no sticky label corner for a single-date poll', () => {
    const { container } = renderGrid({ dates: ['2026-07-28'] })
    expect(container.querySelector('[data-scroll-label]')).not.toBeInTheDocument()
  })

  it('keeps the date in every cell label for a single-date poll', () => {
    renderGrid({
      dates: ['2026-07-28'],
      slotAriaLabels: ['9:00–10:00 AM'],
      slotLabels: [{ dayOffset: 0, label: '9a' }],
    })
    expect(screen.getByRole('button', { name: 'Tue, Jul 28, 9:00–10:00 AM' })).toBeInTheDocument()
  })

  it('renders a row header once there is more than one date', () => {
    renderGrid({ dates: ['2026-07-28', '2026-07-29'] })
    expect(screen.getAllByRole('rowheader')).toHaveLength(2)
  })
})

describe('PaintGrid scroll edge indicators', () => {
  it('shows a right-edge indicator once content overflows, and hides it once scrolled to the end', () => {
    const { container } = renderGrid()
    const scrollport = container.querySelector('.overflow-auto') as HTMLElement
    Object.defineProperty(scrollport, 'clientWidth', { configurable: true, value: 100 })
    Object.defineProperty(scrollport, 'scrollWidth', { configurable: true, value: 300 })
    Object.defineProperty(scrollport, 'scrollLeft', { configurable: true, value: 0, writable: true })

    act(() => {
      scrollport.dispatchEvent(new Event('scroll'))
    })
    expect(screen.getByTestId('scroll-edge-right')).toBeInTheDocument()
    expect(screen.queryByTestId('scroll-edge-left')).not.toBeInTheDocument()

    act(() => {
      scrollport.scrollLeft = 200
      scrollport.dispatchEvent(new Event('scroll'))
    })
    expect(screen.queryByTestId('scroll-edge-right')).not.toBeInTheDocument()
    expect(screen.getByTestId('scroll-edge-left')).toBeInTheDocument()
  })
})
