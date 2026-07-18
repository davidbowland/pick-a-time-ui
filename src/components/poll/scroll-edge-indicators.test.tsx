import '@testing-library/jest-dom'
import { render } from '@testing-library/react'
import React from 'react'

import { ScrollEdgeIndicators } from './scroll-edge-indicators'

describe('ScrollEdgeIndicators', () => {
  it('renders nothing when no direction has more content', () => {
    const { queryByTestId } = render(
      <ScrollEdgeIndicators
        edges={{ canScrollDown: false, canScrollLeft: false, canScrollRight: false, canScrollUp: false }}
      />,
    )
    expect(queryByTestId('scroll-edge-left')).not.toBeInTheDocument()
    expect(queryByTestId('scroll-edge-right')).not.toBeInTheDocument()
    expect(queryByTestId('scroll-edge-up')).not.toBeInTheDocument()
    expect(queryByTestId('scroll-edge-down')).not.toBeInTheDocument()
  })

  it('renders only the indicators for directions that still have more content', () => {
    const { queryByTestId } = render(
      <ScrollEdgeIndicators
        edges={{ canScrollDown: true, canScrollLeft: true, canScrollRight: false, canScrollUp: false }}
      />,
    )
    expect(queryByTestId('scroll-edge-left')).toBeInTheDocument()
    expect(queryByTestId('scroll-edge-down')).toBeInTheDocument()
    expect(queryByTestId('scroll-edge-right')).not.toBeInTheDocument()
    expect(queryByTestId('scroll-edge-up')).not.toBeInTheDocument()
  })

  it('renders all four indicators when every direction has more content', () => {
    const { queryByTestId } = render(
      <ScrollEdgeIndicators
        edges={{ canScrollDown: true, canScrollLeft: true, canScrollRight: true, canScrollUp: true }}
      />,
    )
    expect(queryByTestId('scroll-edge-left')).toBeInTheDocument()
    expect(queryByTestId('scroll-edge-right')).toBeInTheDocument()
    expect(queryByTestId('scroll-edge-up')).toBeInTheDocument()
    expect(queryByTestId('scroll-edge-down')).toBeInTheDocument()
  })
})
