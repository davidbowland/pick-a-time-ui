import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { readFileSync } from 'fs'
import { join } from 'path'
import React from 'react'

import { HeatGrid, heatColorFor } from './heat-grid'
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
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
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
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('reveals who is free, by display name, when a cell is activated', async () => {
    render(
      <HeatGrid
        cells={cells}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        slotLabels={['6:00–7:00 PM']}
        users={users}
      />,
    )
    await userEvent.click(screen.getByRole('button', { name: /thu, sep 4/i }))
    expect(await screen.findByText(/amber harbor/i)).toBeInTheDocument()
    expect(await screen.findByText(/^b$/i)).toBeInTheDocument()
  })

  it('renders a legend spanning 0 free to all free', () => {
    render(
      <HeatGrid
        cells={cells}
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
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
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
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
        dateLabels={['Thu, Sep 4']}
        participantCount={2}
        slotLabels={[]}
        users={users}
      />,
    )

    expect(screen.getByRole('button', { name: /thu, sep 4, 2 of 2 free/i })).toBeInTheDocument()
  })
})
