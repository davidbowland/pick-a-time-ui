import React from 'react'

import { GridColumns } from './grid-columns'
import '@testing-library/jest-dom'
import { render } from '@testing-library/react'

// Column count is structural, not style: the project's no-style-assertions rule does not cover it,
// and a wrong <col> count silently mis-sizes every column with nothing to catch it.
describe('GridColumns', () => {
  const renderColgroup = (columnCount: number, hasLabelColumn: boolean): HTMLElement => {
    const { container } = render(
      <table>
        <GridColumns columnCount={columnCount} hasLabelColumn={hasLabelColumn} />
      </table>,
    )
    return container
  }

  it('renders one col per slot column plus the label col', () => {
    expect(renderColgroup(6, true).querySelectorAll('col')).toHaveLength(7)
  })

  it('renders only the slot cols when there is no label column', () => {
    expect(renderColgroup(6, false).querySelectorAll('col')).toHaveLength(6)
  })

  it('renders just the label col when there are no slot columns', () => {
    expect(renderColgroup(0, true).querySelectorAll('col')).toHaveLength(1)
  })
})
