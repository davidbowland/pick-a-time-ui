import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import React from 'react'

import { TimeWindow } from '../slot-columns'
import { mockColumnLayout } from '../test-column-layout-mock'
import PaintGrid, { PaintGridProps } from './grid'

function windowFor(startMinute: number): TimeWindow {
  return { endMinute: startMinute + 30, startMinute }
}

function renderGrid(overrides: Partial<PaintGridProps> = {}): ReturnType<typeof render> {
  const columns = [0, 30, 60, 90, 120, 150].map(windowFor)
  const props: PaintGridProps = {
    columns,
    dates: ['2026-07-15', '2026-07-16'],
    grid: [
      [false, false, true, true, false, false],
      [false, false, false, true, true, false],
    ],
    onCommit: jest.fn(),
    slotLabels: columns.map((c) => `${c.startMinute}`),
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
        slotLabels: columns.map((c) => `${c.startMinute}`),
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
    expect(screen.getByRole('rowheader', { name: /jul 15/i })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: /jul 16/i })).toBeInTheDocument()
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
