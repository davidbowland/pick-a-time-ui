import React from 'react'

import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from './scenes'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

describe('illustrative story scenes', () => {
  it('HeroScene narrates finding the minute everyone is free', () => {
    render(<HeroScene />)
    expect(screen.getByRole('heading', { name: /find the minute/i })).toBeInTheDocument()
  })

  it('HeroScene renders an action slot when given one', () => {
    render(<HeroScene action={<button type="button">Start</button>} />)
    expect(screen.getByRole('button', { name: 'Start' })).toBeInTheDocument()
  })

  it('IdentityScene narrates choosing your own name, with an auto-generated one as the fallback', () => {
    render(<IdentityScene />)
    expect(screen.getByRole('heading', { name: /quiet falcon/i })).toBeInTheDocument()
  })

  it('PaintingScene narrates marking dates and times', () => {
    render(<PaintingScene />)
    expect(screen.getByRole('heading', { name: /paint your hours/i })).toBeInTheDocument()
  })

  it('ResultsScene narrates finding the best time at a glance', () => {
    render(<ResultsScene />)
    expect(screen.getByRole('heading', { name: /best time/i })).toBeInTheDocument()
  })

  it('ShareScene narrates the one shareable link', () => {
    render(<ShareScene />)
    expect(screen.getByRole('heading', { name: /one link/i })).toBeInTheDocument()
  })

  it('ShareScene draws a real QR code for the pick-a-time homepage', () => {
    const { container } = render(<ShareScene />)
    expect(container.querySelector('svg title')).toHaveTextContent('QR code for pick-a-time.com')
  })

  it('none of the illustrative phone mockups expose fake interactive controls to assistive tech', () => {
    for (const Scene of [HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene]) {
      const { container, unmount } = render(<Scene />)
      const mock = container.querySelector('[aria-hidden="true"]')
      expect(mock).toBeInTheDocument()
      unmount()
    }
  })

  it('alternates which side the visual sits on to avoid a repetitive left-copy/right-visual template', () => {
    const reversedScenes = [IdentityScene, ResultsScene]
    const standardScenes = [HeroScene, PaintingScene, ShareScene]

    for (const Scene of reversedScenes) {
      const { container, unmount } = render(<Scene />)
      const visualWrapper = container.querySelector('[inert]')?.parentElement
      const copyWrapper = screen.getByRole('heading', { level: 2 }).parentElement
      expect(visualWrapper).toHaveClass('md:order-first')
      expect(copyWrapper).toHaveClass('md:order-last')
      unmount()
    }

    for (const Scene of standardScenes) {
      const { container, unmount } = render(<Scene />)
      const visualWrapper = container.querySelector('[inert]')?.parentElement
      const copyWrapper = screen.getByRole('heading', { level: 2 }).parentElement
      expect(visualWrapper).not.toHaveClass('md:order-first')
      expect(copyWrapper).not.toHaveClass('md:order-last')
      unmount()
    }
  })
})
