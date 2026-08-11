import React from 'react'

import { HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene } from './scenes'
import { SkyBackground } from './sky-background'
import { useScrollProgress } from '@hooks/useScrollProgress'
import '@testing-library/jest-dom'
import { render, screen } from '@testing-library/react'

jest.mock('@hooks/useScrollProgress')

const ALL_SCENES = [HeroScene, IdentityScene, PaintingScene, ResultsScene, ShareScene]

describe('illustrative story scenes', () => {
  it('HeroScene narrates finding the minute everyone is free', () => {
    render(<HeroScene />)
    expect(screen.getByRole('heading', { name: /find the minute/i })).toBeInTheDocument()
  })

  it('HeroScene is the page heading, so the homepage has an h1 at all', () => {
    render(<HeroScene />)
    expect(screen.getByRole('heading', { level: 1, name: /find the minute/i })).toBeInTheDocument()
  })

  it('every other scene sits a level below the hero', () => {
    for (const Scene of [IdentityScene, PaintingScene, ResultsScene, ShareScene]) {
      const { unmount } = render(<Scene />)
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
      unmount()
    }
  })

  it('drops every scene to an h3 when asked, for a story that hangs off another surface heading', () => {
    for (const Scene of ALL_SCENES) {
      const { unmount } = render(<Scene headingLevel="h3" />)
      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument()
      unmount()
    }
  })

  it('renders any scene at an explicitly requested h2', () => {
    for (const Scene of ALL_SCENES) {
      const { unmount } = render(<Scene headingLevel="h2" />)
      expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument()
      unmount()
    }
  })

  it('renders a scene at an explicitly requested h1', () => {
    render(<IdentityScene headingLevel="h1" />)
    expect(screen.getByRole('heading', { level: 1, name: /quiet falcon/i })).toBeInTheDocument()
  })

  it('keeps the heading text the same whatever level it is rendered at', () => {
    for (const headingLevel of ['h1', 'h2', 'h3'] as const) {
      const { unmount } = render(<PaintingScene headingLevel={headingLevel} />)
      expect(screen.getByRole('heading', { name: /paint your hours/i })).toBeInTheDocument()
      unmount()
    }
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
    for (const Scene of ALL_SCENES) {
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
      // Unlevelled on purpose: the hero's heading is an h1 and the rest are h2s, and this test is
      // about which column the visual lands in, not about the outline.
      const copyWrapper = screen.getByRole('heading').parentElement
      expect(visualWrapper).toHaveClass('md:order-first')
      expect(copyWrapper).toHaveClass('md:order-last')
      unmount()
    }

    for (const Scene of standardScenes) {
      const { container, unmount } = render(<Scene />)
      const visualWrapper = container.querySelector('[inert]')?.parentElement
      // Unlevelled on purpose: the hero's heading is an h1 and the rest are h2s, and this test is
      // about which column the visual lands in, not about the outline.
      const copyWrapper = screen.getByRole('heading').parentElement
      expect(visualWrapper).not.toHaveClass('md:order-first')
      expect(copyWrapper).not.toHaveClass('md:order-last')
      unmount()
    }
  })
})

// Lives here rather than in sky-background/index.test.tsx because `pinned` arrived with the scene
// heading levels, in the same change, for the same composition — a page that shows the story
// collapsed instead of scrolling it. Move it next to its siblings when that file is next touched.
describe('SkyBackground pinned to night', () => {
  beforeAll(() => {
    // The day midpoint: the one scroll position where pinned and unpinned cannot agree.
    jest.mocked(useScrollProgress).mockReturnValue(0.5)
  })

  it('publishes the day copy-color at the midpoint when it is free to follow the scroll', () => {
    render(<SkyBackground />)
    expect(document.documentElement.style.getPropertyValue('--copy-color')).toBe('#17171a')
  })

  it('publishes the night copy-color at that same scroll position when pinned', () => {
    render(<SkyBackground pinned />)
    expect(document.documentElement.style.getPropertyValue('--copy-color')).toBe('#f2f1ee')
  })

  it('follows the scroll again when pinned is passed explicitly false', () => {
    render(<SkyBackground pinned={false} />)
    expect(document.documentElement.style.getPropertyValue('--copy-color')).toBe('#17171a')
  })

  it('stays hidden from assistive tech when pinned', () => {
    const { container } = render(<SkyBackground pinned />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })
})
