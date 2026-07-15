import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import { Mark } from './index'

describe('Mark component', () => {
  it('should render an svg hidden from assistive tech', () => {
    const { container } = render(<Mark />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('aria-hidden', 'true')
  })

  it('should default to a 32px square', () => {
    const { container } = render(<Mark />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '32')
    expect(svg).toHaveAttribute('height', '32')
  })

  it('should render at a custom size', () => {
    const { container } = render(<Mark size={64} />)

    const svg = container.querySelector('svg')
    expect(svg).toHaveAttribute('width', '64')
    expect(svg).toHaveAttribute('height', '64')
  })

  it('should trace the P shape with exactly nine ink cells', () => {
    const { container } = render(<Mark />)

    const cells = container.querySelectorAll('rect[fill="var(--ink)"]')
    expect(cells).toHaveLength(9)
  })
})
