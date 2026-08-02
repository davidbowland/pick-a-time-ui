import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'

import { TimeWindow } from '../slot-columns'
import { mockColumnLayout } from '../test-column-layout-mock'
import { HeatGrid, heatColorFor, isBestSlotCell, isRecommendedCell } from './heat-grid'
import { OverlapCell, RecommendedMeeting } from '@services/api'
import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { User } from '@types'
import { contrastRatio } from '@utils/contrast'

type HeatGridProps = React.ComponentProps<typeof HeatGrid>

const defaultUsers: User[] = [
  { userId: 'a', name: 'Amber Harbor' },
  { userId: 'b', name: null },
]

const defaultCells = [
  [{ dateIndex: 0, slotIndex: 0, startMinute: 1080, endMinute: 1140, freeCount: 2, freeUserIds: ['a', 'b'] }],
]

// Rebuilds the long comma'd form the grid names rows and cells with from the short form it shows.
// buildGridDateLabels emits `Thu Sep 4` on the first row of a month and `Fri 5` on the rows after;
// formatShortDate always emits `Thu, Sep 4` / `Fri, Sep 5`. The two arrays are NEVER equal in
// production, so defaulting one to the other would let a regression that named cells with the short
// label sail through the whole suite.
function toDateAriaLabels(dateLabels: string[]): string[] {
  return dateLabels.reduce<{ labels: string[]; month: string }>(
    (acc, label) => {
      const parts = label.split(' ')
      const month = parts.length === 3 ? parts[1] : acc.month
      return { labels: [...acc.labels, `${parts[0]}, ${month} ${parts[parts.length - 1]}`], month }
    },
    { labels: [], month: '' },
  ).labels
}

// One render site for the whole suite: every test renders the same table with a different corner
// varied, so a change to HeatGrid's prop shape is one edit here rather than one per test.
function renderHeatGrid(overrides: Partial<HeatGridProps> = {}): ReturnType<typeof render> {
  const dateLabels = overrides.dateLabels ?? ['Thu Sep 4']
  const props: HeatGridProps = {
    cells: defaultCells,
    columns: [{ endMinute: 1140, startMinute: 1080 }],
    dateAriaLabels: toDateAriaLabels(dateLabels),
    dateLabels,
    participantCount: 2,
    recommendedMeetings: [],
    slotAriaLabels: ['6:00–7:00 PM'],
    slotLabels: [{ dayOffset: 0, label: '6p' }],
    users: defaultUsers,
    ...overrides,
  }
  return render(<HeatGrid {...props} />)
}

function readCssVar(css: string, name: string): string {
  const match = css.match(new RegExp(`--${name}:\\s*([^;]+);`))
  if (!match) throw new Error(`Token --${name} not found in index.css`)
  return match[1].trim()
}

describe('HeatGrid HEAT_STEPS hardcoded hexes', () => {
  const cssTokens = readFileSync(join(process.cwd(), 'src/assets/css/index.css'), 'utf-8')
  const heatGridSource = readFileSync(join(process.cwd(), 'src/components/poll/results/heat-grid.tsx'), 'utf-8')

  const stepMatches = [...heatGridSource.matchAll(/cssVar: '(--heat-\d)', hex: '(#[0-9a-f]{6})'/g)]

  it('extracts all five heat steps from heat-grid.tsx', () => {
    expect(stepMatches).toHaveLength(5)
  })

  it.each(stepMatches.map(([, cssVar, hex]) => [cssVar, hex]))(
    'hardcoded hex for %s matches the live value in index.css',
    (cssVar, hex) => {
      const varName = cssVar.replace(/^--/, '')
      expect(hex).toBe(readCssVar(cssTokens, varName))
    },
  )
})

describe('HeatGrid HEAT_STEPS contrast', () => {
  const heatGridSource = readFileSync(join(process.cwd(), 'src/components/poll/results/heat-grid.tsx'), 'utf-8')
  const hexes = [...heatGridSource.matchAll(/cssVar: '(--heat-\d)', hex: '(#[0-9a-f]{6})'/g)].map(([, , hex]) => hex)
  const PAGE_BACKGROUND = '#17171a' // --ink, src/assets/css/index.css

  it.each(hexes.map((hex) => [hex]))(
    '%s clears the WCAG 1.4.11 3:1 non-text contrast minimum against the page background',
    (hex) => {
      expect(contrastRatio(hex, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3)
    },
  )
})

describe('heatColorFor', () => {
  const PAGE_BACKGROUND = '#17171a' // --ink, src/assets/css/index.css

  it('returns the darkest step hex when nobody is free', () => {
    expect(heatColorFor(0, 5)).toBe('#287156')
  })

  it('returns the brightest step hex when everybody is free', () => {
    expect(heatColorFor(5, 5)).toBe('#b4e4d3')
  })

  it('returns the darkest step hex when there are no participants', () => {
    expect(heatColorFor(0, 0)).toBe('#287156')
  })

  it('gives every free-count its own distinct color for a 5-person poll, instead of collapsing onto shared buckets', () => {
    const colors = [0, 1, 2, 3, 4, 5].map((free) => heatColorFor(free, 5))
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('gives every free-count its own distinct color for a 6-person poll', () => {
    const colors = [0, 1, 2, 3, 4, 5, 6].map((free) => heatColorFor(free, 6))
    expect(new Set(colors).size).toBe(colors.length)
  })

  it('increases in brightness (contrast against the page background) as more people are free', () => {
    const contrasts = [0, 1, 2, 3, 4, 5, 6].map((free) => contrastRatio(heatColorFor(free, 6), PAGE_BACKGROUND))
    for (let i = 1; i < contrasts.length; i++) {
      expect(contrasts[i]).toBeGreaterThan(contrasts[i - 1])
    }
  })

  it.each(Array.from({ length: 21 }, (_, i) => i))(
    'clears the WCAG 1.4.11 3:1 non-text contrast minimum at %i/20ths of the way through the gradient',
    (i) => {
      const ratio = i / 20
      const color = heatColorFor(ratio * 100, 100)
      expect(contrastRatio(color, PAGE_BACKGROUND)).toBeGreaterThanOrEqual(3)
    },
  )
})

describe('isRecommendedCell', () => {
  const recommendedMeetings: RecommendedMeeting[] = [
    {
      dateIndex: 0,
      slotIndex: 1,
      date: '2025-09-04',
      startMinute: 1110,
      endMinute: 1170,
      freeCount: 2,
      freeUserIds: [],
    },
  ]

  it('matches a cell whose dateIndex/slotIndex is in the recommended list', () => {
    expect(isRecommendedCell({ dateIndex: 0, slotIndex: 1 }, recommendedMeetings)).toBe(true)
  })

  it('does not match a cell outside the recommended list', () => {
    expect(isRecommendedCell({ dateIndex: 0, slotIndex: 0 }, recommendedMeetings)).toBe(false)
  })

  it('does not match anything against an empty recommended list', () => {
    expect(isRecommendedCell({ dateIndex: 0, slotIndex: 1 }, [])).toBe(false)
  })
})

describe('isBestSlotCell', () => {
  const bestSlot = { dateIndex: 1, slotIndex: 2 }

  it('matches the cell at the best-slot position', () => {
    expect(isBestSlotCell({ dateIndex: 1, slotIndex: 2 }, bestSlot)).toBe(true)
  })

  it('does not match a different cell', () => {
    expect(isBestSlotCell({ dateIndex: 1, slotIndex: 0 }, bestSlot)).toBe(false)
  })

  it('does not match anything when there is no best slot', () => {
    expect(isBestSlotCell({ dateIndex: 1, slotIndex: 2 }, undefined)).toBe(false)
  })
})

describe('HeatGrid', () => {
  const recommendedFirstCell: RecommendedMeeting[] = [
    {
      dateIndex: 0,
      slotIndex: 0,
      date: '2025-09-04',
      startMinute: 1080,
      endMinute: 1140,
      freeCount: 2,
      freeUserIds: [],
    },
  ]

  it('renders one cell per date/slot with an accessible label naming the date, slot time, and free count', () => {
    renderHeatGrid()
    expect(screen.getByRole('button', { name: /thu, sep 4.*6:00.*2 of 2 free/i })).toBeInTheDocument()
  })

  it('shows the free count as visible text inside the cell, not color alone', () => {
    renderHeatGrid()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('adds a "recommended" suffix to a cell matched in recommendedMeetings', () => {
    renderHeatGrid({ recommendedMeetings: recommendedFirstCell })
    expect(screen.getByRole('button')).toHaveAccessibleName(/recommended/i)
    expect(screen.getByRole('button')).not.toHaveAccessibleName(/best time/i)
  })

  it('adds a "recommended, best time" suffix when the cell also matches bestSlot', () => {
    renderHeatGrid({ bestSlot: { dateIndex: 0, slotIndex: 0 }, recommendedMeetings: recommendedFirstCell })
    expect(screen.getByRole('button')).toHaveAccessibleName(/recommended, best time/i)
  })

  it('adds no suffix to a cell that is not recommended', () => {
    renderHeatGrid()
    expect(screen.getByRole('button')).not.toHaveAccessibleName(/recommended/i)
  })

  it('reveals who is free, by display name, when a cell is activated', async () => {
    renderHeatGrid()
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    expect(await screen.findByText(/^b$/i)).toBeInTheDocument()
  })

  it('shows the viewer as "You", listed first, when they are among the free users', async () => {
    renderHeatGrid({ viewerUserId: 'b' })
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/^You$/)
    expect(items[1]).toHaveTextContent(/amber harbor/i)
  })

  it('closes the popover when the same cell is clicked again', async () => {
    renderHeatGrid()
    const cellButton = screen.getByRole('button', { name: /thu, sep 4/i })
    await userEvent.click(cellButton)
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    await userEvent.click(cellButton)
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('closes when the star badge inside a best-slot cell is clicked to close it', async () => {
    renderHeatGrid({ bestSlot: { dateIndex: 0, slotIndex: 0 }, recommendedMeetings: recommendedFirstCell })
    const cellButton = screen.getByRole('button', { name: /recommended, best time/i })
    await userEvent.click(cellButton)
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    const starBadge = screen.getByTestId('best-slot-star')
    await userEvent.click(starBadge)
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('moves the popover to a newly clicked cell and closes the previous one', async () => {
    const twoCellRow = [
      [
        { dateIndex: 0, slotIndex: 0, startMinute: 1080, endMinute: 1140, freeCount: 2, freeUserIds: ['a', 'b'] },
        { dateIndex: 0, slotIndex: 1, startMinute: 1140, endMinute: 1200, freeCount: 1, freeUserIds: ['a'] },
      ],
    ]
    renderHeatGrid({
      cells: twoCellRow,
      columns: [
        { endMinute: 1140, startMinute: 1080 },
        { endMinute: 1200, startMinute: 1140 },
      ],
      slotAriaLabels: ['6:00–7:00 PM', '7:00–8:00 PM'],
      slotLabels: [
        { dayOffset: 0, label: '6p' },
        { dayOffset: 0, label: '7p' },
      ],
    })
    const [firstCell, secondCell] = screen.getAllByRole('button')
    await userEvent.click(firstCell)
    expect(await screen.findByText(/^b$/i)).toBeInTheDocument()
    await userEvent.click(secondCell)
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    expect(screen.queryByText(/^b$/i)).not.toBeInTheDocument()
  })

  it('reflects open state on the cell button via aria-expanded', async () => {
    renderHeatGrid()
    const cellButton = screen.getByRole('button', { name: /thu, sep 4/i })
    expect(cellButton).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(cellButton)
    expect(cellButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes when Escape is pressed while open', async () => {
    renderHeatGrid()
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('closes when clicking outside the popover', async () => {
    renderHeatGrid()
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    await userEvent.click(document.body)
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('closes an open popover when the grid is scrolled', async () => {
    renderHeatGrid()
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    fireEvent.scroll(screen.getByRole('button', { name: /thu, sep 4/i }).closest('table')!.parentElement!)
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('shows the hint both before and after a cell is selected', async () => {
    renderHeatGrid()
    expect(screen.getByText(/tap a square to see who.s free/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(screen.getByText(/tap a square to see who.s free/i)).toBeInTheDocument()
  })

  it('renders a legend spanning 0 free to all free', () => {
    renderHeatGrid()
    expect(screen.getByText(/0 free/i)).toBeInTheDocument()
    expect(screen.getByText(/all free/i)).toBeInTheDocument()
  })

  it('shows a no-availability prompt when every cell has zero free people', () => {
    const emptyCells = [
      [{ dateIndex: 0, slotIndex: 0, startMinute: 1080, endMinute: 1140, freeCount: 0, freeUserIds: [] }],
    ]
    renderHeatGrid({ cells: emptyCells })
    expect(screen.getByText(/tap a square/i)).toBeInTheDocument()
  })

  it('renders a single column with no slot header row for a dates-only poll', () => {
    const datesOnlyCells = [
      [{ dateIndex: 0, slotIndex: 0, startMinute: 0, endMinute: 1440, freeCount: 2, freeUserIds: ['a', 'b'] }],
    ]
    renderHeatGrid({ cells: datesOnlyCells, columns: [], slotAriaLabels: [], slotLabels: [] })

    expect(screen.getByRole('button', { name: /thu, sep 4, 2 of 2 free/i })).toBeInTheDocument()
  })

  it('renders a disabled, non-interactive cell for a date/column combination the date does not offer', () => {
    const mixedCells = [
      [{ dateIndex: 0, slotIndex: 0, startMinute: 540, endMinute: 600, freeCount: 2, freeUserIds: ['a', 'b'] }],
      [{ dateIndex: 1, slotIndex: 0, startMinute: 660, endMinute: 720, freeCount: 1, freeUserIds: ['a'] }],
    ]
    renderHeatGrid({
      cells: mixedCells,
      columns: [
        { endMinute: 600, startMinute: 540 },
        { endMinute: 720, startMinute: 660 },
      ],
      dateLabels: ['Thu Sep 4', 'Sat Sep 6'],
      slotAriaLabels: ['9:00–10:00 AM', '11:00 AM–12:00 PM'],
      slotLabels: [
        { dayOffset: 0, label: '9a' },
        { dayOffset: 0, label: '11a' },
      ],
    })

    // Two dates x two columns = 4 grid positions, but each date only has a real slot for one of
    // them — exactly 2 tappable buttons, not 4.
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})

describe('HeatGrid labels', () => {
  const shortLabels = [
    { dayOffset: 0, label: '9a' },
    { dayOffset: 0, label: '10a' },
  ]
  const longLabels = ['9:00–10:00 AM', '10:00–11:00 AM']
  const twoColumns = [
    { endMinute: 600, startMinute: 540 },
    { endMinute: 660, startMinute: 600 },
  ]
  const twoColumnCells = [
    [
      { dateIndex: 0, endMinute: 600, freeCount: 2, freeUserIds: ['a', 'b'], slotIndex: 0, startMinute: 540 },
      { dateIndex: 0, endMinute: 660, freeCount: 1, freeUserIds: ['a'], slotIndex: 1, startMinute: 600 },
    ],
  ]

  const renderLabelled = (slotLabels: { dayOffset: number; label: string }[]): ReturnType<typeof render> =>
    renderHeatGrid({
      cells: twoColumnCells,
      columns: twoColumns,
      slotAriaLabels: longLabels,
      slotLabels,
    })

  it('shows the abbreviated column label as the visible header text', () => {
    renderLabelled(shortLabels)
    expect(screen.getByText('9a')).toBeInTheDocument()
  })

  // A `<th scope="col">`'s own text is announced during table navigation, so the abbreviation
  // would otherwise be read out verbatim as "nine a". The aria-label keeps the abbreviation a
  // purely visual economy.
  it('names each column header with the full time range rather than the abbreviation', () => {
    renderLabelled(shortLabels)
    expect(screen.getByRole('columnheader', { name: '9:00–10:00 AM' })).toBeInTheDocument()
  })

  it('marks a column that falls on the next day for the viewer', () => {
    renderLabelled([
      { dayOffset: 1, label: '1a' },
      { dayOffset: 0, label: '2a' },
    ])
    expect(screen.getByText('+1')).toBeInTheDocument()
  })

  it('marks a column that falls on the previous day for the viewer', () => {
    renderLabelled([
      { dayOffset: -1, label: '11p' },
      { dayOffset: 0, label: '12a' },
    ])
    expect(screen.getByText('−1')).toBeInTheDocument()
  })

  it('keeps the full unabbreviated time range in each cell label', () => {
    renderLabelled(shortLabels)
    expect(screen.getByRole('button', { name: 'Thu, Sep 4, 9:00–10:00 AM, 2 of 2 free' })).toBeInTheDocument()
  })

  // The visible row label drops the month on every row after a month change, which is fine in a
  // column the reader scans top to bottom. A cell's aria-label is the opposite situation — it is
  // the out-of-context announcement for someone who tabbed straight into the middle of the grid —
  // so it takes the long form even when the row header beside it does not.
  it('names each cell with the full date even where the row header omits the month', () => {
    renderHeatGrid({
      cells: twoColumnCells,
      columns: twoColumns,
      dateAriaLabels: ['Thu, Sep 4', 'Fri, Sep 5'],
      dateLabels: ['Thu Sep 4', 'Fri 5'],
      slotAriaLabels: longLabels,
      slotLabels: shortLabels,
    })
    expect(screen.getByText('Fri 5')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Thu, Sep 4, 9:00–10:00 AM, 2 of 2 free' })).toBeInTheDocument()
  })

  // A `<th scope="row">`'s own text is announced during table navigation, exactly as a
  // `<th scope="col">`'s is, so without an aria-label a row after a month change announces
  // `Fri 5` — a date with no month anywhere in it.
  it('names each row header with the full date while showing the short form', () => {
    renderHeatGrid({ dateAriaLabels: ['Thu, Sep 4', 'Fri, Sep 5'], dateLabels: ['Thu Sep 4', 'Fri 5'] })
    expect(screen.getByRole('rowheader', { name: 'Fri, Sep 5' })).toBeInTheDocument()
    expect(screen.getByText('Fri 5')).toBeInTheDocument()
  })
})

// buildGridDateLabels repeats the month only when it changes, so every row after the first in a
// month is a bare `Weekday Day`. Two months whose first days fall on the same weekday therefore
// emit byte-identical labels: April and July 2026 are aligned, so
// ['2026-04-07', '2026-04-08', '2026-07-07', '2026-07-08'] yields
// ['Tue Apr 7', 'Wed 8', 'Tue Jul 7', 'Wed 8']. Poll creation allows non-contiguous multi-select
// across a 365-day range, so this shape is reachable — and keying the <tr> on the visible label
// would collapse the two `Wed 8` rows onto one React key.
describe('HeatGrid duplicate visible date labels', () => {
  const collidingLabels = ['Tue Apr 7', 'Wed 8', 'Tue Jul 7', 'Wed 8']
  const collidingAriaLabels = ['Tue, Apr 7', 'Wed, Apr 8', 'Tue, Jul 7', 'Wed, Jul 8']
  // One distinct freeCount per row, so a cell's accessible name proves which row it came from.
  const collidingCells = collidingAriaLabels.map((_ariaLabel, dateIndex) => [
    { dateIndex, endMinute: 1140, freeCount: dateIndex, freeUserIds: [], slotIndex: 0, startMinute: 1080 },
  ])

  const renderColliding = (): ReturnType<typeof render> =>
    renderHeatGrid({
      cells: collidingCells,
      dateAriaLabels: collidingAriaLabels,
      dateLabels: collidingLabels,
      participantCount: 4,
    })

  it('renders a row for every date even when two rows share a visible label', () => {
    renderColliding()
    expect(screen.getAllByRole('rowheader')).toHaveLength(4)
  })

  it('keeps each colliding row bound to its own date in the cell accessible names', () => {
    renderColliding()
    expect(screen.getByRole('button', { name: 'Wed, Apr 8, 6:00–7:00 PM, 1 of 4 free' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Wed, Jul 8, 6:00–7:00 PM, 3 of 4 free' })).toBeInTheDocument()
  })

  // React logs a duplicate-key error rather than throwing, and on a first mount it still paints
  // every row — so the two assertions above cannot see the defect on their own. The warning is the
  // observable signal that the rows are sharing an identity, and sharing it is what lets React
  // reuse one row's cells and popover trigger for another row's date on a later re-render.
  it('gives every row its own React key', () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)
    renderColliding()
    const duplicateKeyErrors = errorSpy.mock.calls.filter((call) => String(call[0]).includes('same key'))
    errorSpy.mockRestore()
    expect(duplicateKeyErrors).toEqual([])
  })
})

describe('HeatGrid single-date polls', () => {
  it('renders no row header for a single-date poll', () => {
    renderHeatGrid()
    expect(screen.queryByRole('rowheader')).not.toBeInTheDocument()
  })

  it('renders no sticky label corner for a single-date poll', () => {
    const { container } = renderHeatGrid()
    expect(container.querySelector('[data-scroll-label]')).not.toBeInTheDocument()
  })

  it('keeps the date in every cell label for a single-date poll', () => {
    renderHeatGrid({ dateAriaLabels: ['Thu, Sep 4'] })
    expect(screen.getByRole('button', { name: 'Thu, Sep 4, 6:00–7:00 PM, 2 of 2 free' })).toBeInTheDocument()
  })

  it('renders a row header once there is more than one date', () => {
    renderHeatGrid({ dateLabels: ['Thu Sep 4', 'Fri 5'] })
    expect(screen.getAllByRole('rowheader')).toHaveLength(2)
  })
})

describe('HeatGrid initial scroll', () => {
  function windowFor(startMinute: number): TimeWindow {
    return { endMinute: startMinute + 30, startMinute }
  }

  function cellFor(startMinute: number, freeCount: number): OverlapCell {
    return { ...windowFor(startMinute), dateIndex: 0, freeCount, freeUserIds: [], slotIndex: 0 }
  }

  // Two dates, not one: a single-date grid renders no label column at all, so this would be
  // asserting the presence of an element the component deliberately drops.
  it('renders the scroll-measurement attributes the hook relies on', () => {
    const columns = [0, 30, 60].map(windowFor)
    const { container } = renderHeatGrid({
      cells: [columns.map((c) => cellFor(c.startMinute, 1))],
      columns,
      dateLabels: ['Wed Jul 15', 'Thu 16'],
      slotAriaLabels: columns.map((c) => `${c.startMinute}`),
      slotLabels: columns.map((c) => ({ dayOffset: 0, label: `${c.startMinute}` })),
      users: [],
    })
    expect(container.querySelector('[data-scroll-label]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-scroll-column]')).toHaveLength(3)
  })

  // Also two dates, and load-bearing: with one date there is no `[data-scroll-label]` element,
  // defaultMeasure reports labelWidth 0 instead of the mocked 128, four columns then all "fit",
  // and scrollLeft comes out 0 — a silently different measurement rather than a loud failure.
  // The no-label path gets its own case below instead of quietly taking this one over.
  it('scrolls to the window with the highest combined freeCount', () => {
    const restore = mockColumnLayout(56, 4, 128, 2)
    try {
      const columns = [0, 30, 60, 90].map(windowFor)

      const { container } = renderHeatGrid({
        cells: [[cellFor(0, 0), cellFor(30, 1), cellFor(60, 4), cellFor(90, 3)]],
        columns,
        dateLabels: ['Wed Jul 15', 'Thu 16'],
        participantCount: 4,
        slotAriaLabels: columns.map((c) => `${c.startMinute}`),
        slotLabels: columns.map((c) => ({ dayOffset: 0, label: `${c.startMinute}` })),
        users: [],
      })

      // scores: [0,1,4,3]; 2 visible columns -> best window is [2,3] (sum 7), start 2 -> scrollLeft = 2*60 = 120
      const scrollport = container.querySelector('.overflow-auto') as HTMLElement
      expect(scrollport.scrollLeft).toBe(120)
    } finally {
      restore()
    }

    // Regression check: restore() must remove the patched own-property so HTMLElement.prototype
    // falls back to inheriting Element.prototype's real clientWidth getter again, rather than
    // leaving every element in later tests permanently stuck reporting the fixed mocked width.
    expect(Object.prototype.hasOwnProperty.call(HTMLElement.prototype, 'clientWidth')).toBe(false)
    expect(document.createElement('div').clientWidth).not.toBe(128 + 2 * (56 + 4))
  })

  // The single-date poll is the one that needs this scroll most — every column is a time slot —
  // and it is also the only grid with no `[data-scroll-label]` element to measure. Asserting it
  // deliberately, rather than letting a converted two-date test drift into covering it.
  it('still scrolls a single-date grid, which renders no label column to measure', () => {
    const restore = mockColumnLayout(56, 4, 0, 2)
    try {
      const columns = [0, 30, 60, 90].map(windowFor)

      const { container } = renderHeatGrid({
        cells: [[cellFor(0, 0), cellFor(30, 1), cellFor(60, 4), cellFor(90, 3)]],
        columns,
        dateLabels: ['Wed Jul 15'],
        participantCount: 4,
        slotAriaLabels: columns.map((c) => `${c.startMinute}`),
        slotLabels: columns.map((c) => ({ dayOffset: 0, label: `${c.startMinute}` })),
        users: [],
      })

      expect(container.querySelector('[data-scroll-label]')).not.toBeInTheDocument()
      // Same scores and the same 2 visible columns as the two-date case, measured with a zero
      // label width -> best window is still [2,3], start 2 -> scrollLeft = 2*60 = 120.
      const scrollport = container.querySelector('.overflow-auto') as HTMLElement
      expect(scrollport.scrollLeft).toBe(120)
    } finally {
      restore()
    }
  })

  it('does not scroll a dates-only grid (single implicit column)', () => {
    const { container } = renderHeatGrid({
      cells: [[{ dateIndex: 0, endMinute: 1440, freeCount: 2, freeUserIds: [], slotIndex: 0, startMinute: 0 }]],
      columns: [],
      dateLabels: ['Wed Jul 15'],
      slotAriaLabels: [],
      slotLabels: [],
      users: [],
    })
    const scrollport = container.querySelector('.overflow-auto') as HTMLElement
    expect(scrollport.scrollLeft).toBe(0)
  })
})

describe('HeatGrid semantic table markup', () => {
  // A `position: sticky` element that is itself a raw CSS Grid item loses its stuck position
  // once horizontal scroll nears the end of the scrollable range — reproduced against this
  // exact grid-template-columns/gap/sticky/overflow-auto combination in a real headless browser.
  // jsdom has no layout engine, so it can't see the visual bug directly; rendering as a real
  // <table> with sticky <th> cells sidesteps that class of bug entirely (the standard,
  // battle-tested pattern for frozen table headers/columns), and also gives screen readers real
  // row/column header associations, which the previous plain-div grid never had.
  // Two dates: a single-date grid states its date above the grid and renders no row headers at
  // all, so the association this test exists to prove needs a poll that actually has a date column.
  it('associates each date label with its row via a real table row header', () => {
    renderHeatGrid({ dateLabels: ['Thu Sep 4', 'Fri 5'] })
    expect(screen.getByRole('rowheader', { name: /thu, sep 4/i })).toBeInTheDocument()
    expect(screen.getByRole('rowheader', { name: /fri, sep 5/i })).toBeInTheDocument()
  })

  it('associates each time slot with its column via a real table column header', () => {
    renderHeatGrid()
    expect(screen.getByRole('columnheader', { name: '6:00–7:00 PM' })).toBeInTheDocument()
  })

  it('renders the grid as a real table', () => {
    renderHeatGrid()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})

// The colgroup carries every column width under `table-layout: fixed`, and the table's min-width is
// derived from the same column count. One <col> too few and the label column silently unpins,
// dividing evenly with the slots while min-width undercounts by ~5rem — enough for a many-column
// poll on a phone to fall under the WCAG 2.2 SC 2.5.8 24x24 target minimum. Style assertions are
// barred, so this element count is the only thing that can catch it.
describe('HeatGrid colgroup', () => {
  const countTracksAndCells = (container: HTMLElement): { colgroupTracks: number; firstRowCells: number } => ({
    colgroupTracks: container.querySelectorAll('colgroup col').length,
    firstRowCells: container.querySelector('tbody tr')!.children.length,
  })

  it('declares exactly one column track per rendered cell in a multi-date grid', () => {
    const { colgroupTracks, firstRowCells } = countTracksAndCells(
      renderHeatGrid({ dateLabels: ['Thu Sep 4', 'Fri 5'] }).container,
    )
    expect(colgroupTracks).toBe(firstRowCells)
  })

  it('declares exactly one column track per rendered cell in a single-date grid, which drops the label column', () => {
    const { colgroupTracks, firstRowCells } = countTracksAndCells(renderHeatGrid().container)
    expect(colgroupTracks).toBe(firstRowCells)
  })
})
