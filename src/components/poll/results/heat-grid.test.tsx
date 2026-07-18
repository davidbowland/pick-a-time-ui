import '@testing-library/jest-dom'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'

import { TimeWindow } from '../slot-columns'
import { mockColumnLayout } from '../test-column-layout-mock'
import { HeatGrid, heatColorFor, isBestSlotCell, isRecommendedCell } from './heat-grid'
import { OverlapCell, RecommendedMeeting } from '@services/api'
import { User } from '@types'
import { contrastRatio } from '@utils/contrast'

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
      excludedByCalendar: [],
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
  const users: User[] = [
    { userId: 'a', name: 'Amber Harbor', calendarStatus: 'not_connected' },
    { userId: 'b', name: null, calendarStatus: 'not_connected' },
  ]

  const cells = [
    [{ dateIndex: 0, slotIndex: 0, startMinute: 1080, endMinute: 1140, freeCount: 2, freeUserIds: ['a', 'b'] }],
  ]

  it('renders one cell per date/slot with an accessible label naming the date, slot time, and free count', () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByRole('button', { name: /thu, sep 4.*6:00.*2 of 2 free/i })).toBeInTheDocument()
  })

  it('shows the free count as visible text inside the cell, not color alone', () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('adds a "recommended" suffix to a cell matched in recommendedMeetings', () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[
          {
            dateIndex: 0,
            slotIndex: 0,
            date: '2025-09-04',
            startMinute: 1080,
            endMinute: 1140,
            freeCount: 2,
            freeUserIds: [],
            excludedByCalendar: [],
          },
        ]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByRole('button')).toHaveAccessibleName(/recommended/i)
    expect(screen.getByRole('button')).not.toHaveAccessibleName(/best time/i)
  })

  it('adds a "recommended, best time" suffix when the cell also matches bestSlot', () => {
    render(
      <HeatGrid
        bestSlot={{ dateIndex: 0, slotIndex: 0 }}
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[
          {
            dateIndex: 0,
            slotIndex: 0,
            date: '2025-09-04',
            startMinute: 1080,
            endMinute: 1140,
            freeCount: 2,
            freeUserIds: [],
            excludedByCalendar: [],
          },
        ]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByRole('button')).toHaveAccessibleName(/recommended, best time/i)
  })

  it('adds no suffix to a cell that is not recommended', () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByRole('button')).not.toHaveAccessibleName(/recommended/i)
  })

  it('reveals who is free, by display name, when a cell is activated', async () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    expect(await screen.findByText(/^b$/i)).toBeInTheDocument()
  })

  it('shows the viewer as "You", listed first, when they are among the free users', async () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
        viewerUserId="b"
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    const items = await screen.findAllByRole('listitem')
    expect(items[0]).toHaveTextContent(/^You$/)
    expect(items[1]).toHaveTextContent(/amber harbor/i)
  })

  it('closes the popover when the same cell is clicked again', async () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    const cellButton = screen.getByRole('button', { name: /thu, sep 4/i })
    await userEvent.click(cellButton)
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    await userEvent.click(cellButton)
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('closes when the star badge inside a best-slot cell is clicked to close it', async () => {
    render(
      <HeatGrid
        bestSlot={{ dateIndex: 0, slotIndex: 0 }}
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[
          {
            dateIndex: 0,
            slotIndex: 0,
            date: '2025-09-04',
            startMinute: 1080,
            endMinute: 1140,
            freeCount: 2,
            freeUserIds: [],
            excludedByCalendar: [],
          },
        ]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
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
    render(
      <HeatGrid
        cells={twoCellRow}
        columns={[
          { startMinute: 1080, endMinute: 1140 },
          { startMinute: 1140, endMinute: 1200 },
        ]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM', '7:00–8:00 PM']}
        users={users}
      />,
    )
    const [firstCell, secondCell] = screen.getAllByRole('button')
    await userEvent.click(firstCell)
    expect(await screen.findByText(/^b$/i)).toBeInTheDocument()
    await userEvent.click(secondCell)
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    expect(screen.queryByText(/^b$/i)).not.toBeInTheDocument()
  })

  it('reflects open state on the cell button via aria-expanded', async () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    const cellButton = screen.getByRole('button', { name: /thu, sep 4/i })
    expect(cellButton).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(cellButton)
    expect(cellButton).toHaveAttribute('aria-expanded', 'true')
  })

  it('closes when Escape is pressed while open', async () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('closes when clicking outside the popover', async () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    await userEvent.click(document.body)
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('closes an open popover when the grid is scrolled', async () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    fireEvent.scroll(screen.getByRole('button', { name: /thu, sep 4/i }).closest('table')!.parentElement!)
    await waitFor(() => expect(screen.queryByText(/amber harbor/i)).not.toBeInTheDocument())
  })

  it('shows the hint both before and after a cell is selected', async () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByText(/tap a square to see who.s free/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(screen.getByText(/tap a square to see who.s free/i)).toBeInTheDocument()
  })

  it('renders a legend spanning 0 free to all free', () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByText(/0 free/i)).toBeInTheDocument()
    expect(screen.getByText(/all free/i)).toBeInTheDocument()
  })

  it('shows a no-availability prompt when every cell has zero free people', () => {
    const emptyCells = [
      [{ dateIndex: 0, slotIndex: 0, startMinute: 1080, endMinute: 1140, freeCount: 0, freeUserIds: [] }],
    ]
    render(
      <HeatGrid
        cells={emptyCells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByText(/tap a square/i)).toBeInTheDocument()
  })

  it('renders a single column with no slot header row for a dates-only poll', () => {
    const datesOnlyCells = [
      [{ dateIndex: 0, slotIndex: 0, startMinute: 0, endMinute: 1440, freeCount: 2, freeUserIds: ['a', 'b'] }],
    ]
    render(
      <HeatGrid
        cells={datesOnlyCells}
        columns={[]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={[]}
        users={users}
      />,
    )

    expect(screen.getByRole('button', { name: /thu, sep 4, 2 of 2 free/i })).toBeInTheDocument()
  })

  it('renders a disabled, non-interactive cell for a date/column combination the date does not offer', () => {
    const mixedCells = [
      [{ dateIndex: 0, slotIndex: 0, startMinute: 540, endMinute: 600, freeCount: 2, freeUserIds: ['a', 'b'] }],
      [{ dateIndex: 1, slotIndex: 0, startMinute: 660, endMinute: 720, freeCount: 1, freeUserIds: ['a'] }],
    ]
    render(
      <HeatGrid
        cells={mixedCells}
        columns={[
          { startMinute: 540, endMinute: 600 },
          { startMinute: 660, endMinute: 720 },
        ]}
        dateLabels={['Thu, Sep 4', 'Sat, Sep 6']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['9:00–10:00 AM', '11:00 AM–12:00 PM']}
        users={users}
      />,
    )

    // Two dates x two columns = 4 grid positions, but each date only has a real slot for one of
    // them — exactly 2 tappable buttons, not 4.
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})

describe('HeatGrid initial scroll', () => {
  function windowFor(startMinute: number): TimeWindow {
    return { endMinute: startMinute + 30, startMinute }
  }

  function cellFor(startMinute: number, freeCount: number): OverlapCell {
    return { ...windowFor(startMinute), dateIndex: 0, freeCount, freeUserIds: [], slotIndex: 0 }
  }

  it('renders the scroll-measurement attributes the hook relies on', () => {
    const columns = [0, 30, 60].map(windowFor)
    const { container } = render(
      <HeatGrid
        cells={[columns.map((c) => cellFor(c.startMinute, 1))]}
        columns={columns}
        dateLabels={['Wed, Jul 15']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={columns.map((c) => `${c.startMinute}`)}
        users={[]}
      />,
    )
    expect(container.querySelector('[data-scroll-label]')).toBeInTheDocument()
    expect(container.querySelectorAll('[data-scroll-column]')).toHaveLength(3)
  })

  it('scrolls to the window with the highest combined freeCount', () => {
    const restore = mockColumnLayout(56, 4, 128, 2)
    try {
      const columns = [0, 30, 60, 90].map(windowFor)

      const { container } = render(
        <HeatGrid
          cells={[[cellFor(0, 0), cellFor(30, 1), cellFor(60, 4), cellFor(90, 3)]]}
          columns={columns}
          dateLabels={['Wed, Jul 15']}
          participantCount={4}
          recommendedMeetings={[]}
          slotLabels={columns.map((c) => `${c.startMinute}`)}
          users={[]}
        />,
      )

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

  it('does not scroll a dates-only grid (single implicit column)', () => {
    const { container } = render(
      <HeatGrid
        cells={[[{ dateIndex: 0, endMinute: 1440, freeCount: 2, freeUserIds: [], slotIndex: 0, startMinute: 0 }]]}
        columns={[]}
        dateLabels={['Wed, Jul 15']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={[]}
        users={[]}
      />,
    )
    const scrollport = container.querySelector('.overflow-auto') as HTMLElement
    expect(scrollport.scrollLeft).toBe(0)
  })
})

describe('HeatGrid semantic table markup', () => {
  const users: User[] = []
  const cells = [[{ dateIndex: 0, slotIndex: 0, startMinute: 1080, endMinute: 1140, freeCount: 2, freeUserIds: [] }]]

  // A `position: sticky` element that is itself a raw CSS Grid item loses its stuck position
  // once horizontal scroll nears the end of the scrollable range — reproduced against this
  // exact grid-template-columns/gap/sticky/overflow-auto combination in a real headless browser.
  // jsdom has no layout engine, so it can't see the visual bug directly; rendering as a real
  // <table> with sticky <th> cells sidesteps that class of bug entirely (the standard,
  // battle-tested pattern for frozen table headers/columns), and also gives screen readers real
  // row/column header associations, which the previous plain-div grid never had.
  it('associates each date label with its row via a real table row header', () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByRole('rowheader', { name: /thu, sep 4/i })).toBeInTheDocument()
  })

  it('associates each time slot with its column via a real table column header', () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByRole('columnheader', { name: '6:00–7:00 PM' })).toBeInTheDocument()
  })

  it('renders the grid as a real table', () => {
    render(
      <HeatGrid
        cells={cells}
        columns={[{ startMinute: 1080, endMinute: 1140 }]}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        recommendedMeetings={[]}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
  })
})
